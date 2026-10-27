import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { ScmProductsService } from "../products/products.service.js";
import { round2 } from "../procurement/procurement.helpers.js";
import { ScmNumberingService } from "../common/scm-numbering.service.js";
import { SalesPurchasesIntegrationService } from "../../finance/integration/sales-purchases-integration.service.js";
import type { PostSalesInvoiceTaxItemDto } from "../../finance/integration/dto/post-sales-invoice.dto.js";
import type {
  CreateSalesOrderDto,
  IssueSalesInvoiceDto,
  QuerySalesOrderDto,
} from "./dto/sales.dto.js";
import { SalesOrdersRepository } from "./sales-orders.repository.js";

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly repository: SalesOrdersRepository,
    private readonly products: ScmProductsService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationService: SalesPurchasesIntegrationService,
    private readonly numbering: ScmNumberingService,
    private readonly prisma: PrismaService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  async findAll(query: QuerySalesOrderDto) {
    const { items, total } = await this.repository.findMany(
      this.scope,
      query,
      query,
    );

    if (items.length > 0) {
      const orderIds = items.map((it) => it.id);
      const activeGstEntries = await this.prisma.financeGstEntry.findMany({
        where: {
          organizationId: this.scope.organizationId,
          sourceType: "SALES_INVOICE",
          sourceId: { in: orderIds },
          status: "ACTIVE",
        },
        select: {
          sourceId: true,
          sourceReference: true,
          createdAt: true,
        },
      });

      const gstByOrderId = new Map(
        activeGstEntries.map((e) => [e.sourceId, e]),
      );

      const enriched = items.map((it) => {
        const gst = gstByOrderId.get(it.id);
        return {
          ...it,
          invoiceNumber: gst?.sourceReference ?? null,
          invoicedAt: gst?.createdAt?.toISOString() ?? null,
          invoicedStatus: gst ? "Invoiced" : "Not Invoiced",
        };
      });

      return new PaginatedResponseDto(enriched, total, query.page, query.limit);
    }

    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Sales order", id);

    const gst = await this.prisma.financeGstEntry.findFirst({
      where: {
        organizationId: this.scope.organizationId,
        sourceType: "SALES_INVOICE",
        sourceId: id,
        status: "ACTIVE",
      },
      select: {
        sourceReference: true,
        createdAt: true,
      },
    });

    return {
      ...row,
      invoiceNumber: gst?.sourceReference ?? null,
      invoicedAt: gst?.createdAt?.toISOString() ?? null,
      invoicedStatus: gst ? "Invoiced" : "Not Invoiced",
    };
  }

  async create(dto: CreateSalesOrderDto) {
    const lines = await Promise.all(
      dto.items.map(async (it) => {
        const p = await this.products.findOne(it.productId);
        const taxRate = it.taxRate ?? 0;
        const net = round2(it.quantity * it.unitPrice);
        const total = round2(net + round2(net * (taxRate / 100)));
        return {
          productId: p.id,
          itemCode: p.productCode,
          itemDescription: p.name,
          uom: p.uom,
          salesQty: it.quantity,
          unitPrice: it.unitPrice,
          taxRate,
          total,
        };
      }),
    );
    if (new Set(lines.map((l) => l.productId)).size !== lines.length) {
      throw new BusinessRuleViolationException(
        "A product appears on more than one line — combine them into one line",
        "DUPLICATE_PRODUCT",
      );
    }
    const subtotal = round2(
      lines.reduce((s, l) => s + round2(l.salesQty * l.unitPrice), 0),
    );
    const total = round2(lines.reduce((s, l) => s + l.total, 0));
    return this.repository.create(
      this.scope,
      {
        customerId: dto.customerId,
        orderDate: dto.orderDate,
        expectedDate: dto.expectedDate,
        shipToAddress: dto.shipToAddress,
        billToAddress: dto.billToAddress,
        currency: dto.currency ?? "INR",
        notes: dto.notes,
        lines,
        subtotal,
        taxAmount: round2(total - subtotal),
        total,
      },
      this.actor,
    );
  }

  private async move(id: number, from: readonly string[], to: string) {
    const row = await this.repository.transition(
      this.scope,
      id,
      from,
      to,
      this.actor,
    );
    if (!row) throw new ResourceNotFoundException("Sales order", id);
    return row;
  }

  confirm(id: number) {
    return this.move(id, ["DRAFT"], "CONFIRMED");
  }

  /**
   * Explicitly issues a Tax Invoice from an eligible confirmed sales order,
   * generates a sequential invoice number, posts to the General Ledger,
   * and records multi-line GST output tax ledger entries.
   * Completely idempotent: retrying returns the existing invoice posting result.
   */
  async issueInvoice(id: number, dto?: IssueSalesInvoiceDto) {
    const scope = this.scope;
    const actor = this.actor;

    const order = await this.repository.findOneForInvoicing(scope, id);
    if (!order) throw new ResourceNotFoundException("Sales order", id);

    // 1. Enforce Lifecycle Invariant: Must be CONFIRMED or CLOSED
    if (order.status === "DRAFT") {
      throw new BusinessRuleViolationException(
        "Cannot issue tax invoice for an unconfirmed sales order. Please confirm the order first.",
        "ORDER_NOT_CONFIRMED",
      );
    }
    if (order.status === "CANCELLED") {
      throw new BusinessRuleViolationException(
        "Cannot issue tax invoice for a cancelled sales order.",
        "ORDER_CANCELLED",
      );
    }
    if (order.status !== "CONFIRMED" && order.status !== "CLOSED") {
      throw new InvalidStateTransitionException(
        "SalesOrder",
        order.status,
        "INVOICED",
      );
    }

    // 2. Validate Monetary Invariants
    const subtotal = Number(order.subtotal);
    const taxAmount = Number(order.taxAmount);
    const total = Number(order.total);

    if (total <= 0) {
      throw new BusinessRuleViolationException(
        "Sales order total must be greater than zero to issue a tax invoice.",
        "INVALID_ORDER_TOTAL",
      );
    }
    if (order.items.length === 0) {
      throw new BusinessRuleViolationException(
        "Sales order must contain at least one line item to issue a tax invoice.",
        "EMPTY_ORDER",
      );
    }
    if (Math.abs(round2(subtotal + taxAmount) - total) > 0.02) {
      throw new BusinessRuleViolationException(
        `Order total (${total}) does not match subtotal (${subtotal}) + tax (${taxAmount})`,
        "ORDER_TOTAL_MISMATCH",
      );
    }

    // 3. Idempotency Guard: Check if invoice is already issued for this order
    const existingGst = await this.prisma.financeGstEntry.findFirst({
      where: {
        organizationId: scope.organizationId,
        sourceType: "SALES_INVOICE",
        sourceId: id,
        status: "ACTIVE",
      },
    });

    if (existingGst) {
      const existingJournal = await this.prisma.financeJournalEntry.findFirst({
        where: {
          organizationId: scope.organizationId,
          referenceNumber: existingGst.sourceReference,
          status: "POSTED",
        },
      });

      return {
        success: true,
        alreadyIssued: true,
        salesOrderId: order.id,
        soNumber: order.soNumber,
        invoiceNumber: existingGst.sourceReference,
        invoiceDate: existingGst.period,
        journalEntryId: existingJournal?.id ?? null,
        journalEntryNumber: existingJournal?.entryNumber ?? null,
        gstEntryId: existingGst.id,
        message: `Tax invoice '${existingGst.sourceReference}' has already been issued for order ${order.soNumber}.`,
      };
    }

    // 4. Validate Invoice Date
    const todayStr = new Date().toISOString().slice(0, 10);
    const invoiceDate = dto?.invoiceDate || todayStr;
    if (invoiceDate > todayStr) {
      throw new BusinessRuleViolationException(
        "Invoice date cannot be in the future.",
        "FUTURE_INVOICE_DATE",
      );
    }

    // 5. Generate or assign authoritative sequential invoice number
    let invoiceNumber = dto?.customInvoiceNumber?.trim();
    if (!invoiceNumber) {
      invoiceNumber = await this.numbering.next(
        this.prisma,
        scope.organizationId,
        "taxInvoice",
      );
    }

    // 6. Authoritative Jurisdiction & State Determination
    // Check employer/company GSTIN from payroll settings
    const payrollSettings = await this.prisma.payrollSetting.findFirst({
      where: { organizationId: scope.organizationId },
      select: { companyGstin: true },
    });
    const companyGstin = payrollSettings?.companyGstin?.trim().toUpperCase();
    const companyStateCode =
      companyGstin && companyGstin.length >= 2
        ? companyGstin.slice(0, 2)
        : null;

    const customerGstin = order.customer?.gstin?.trim().toUpperCase() || null;
    const customerStateCode =
      customerGstin && customerGstin.length >= 2
        ? customerGstin.slice(0, 2)
        : null;

    let isInterState = false;
    if (dto?.jurisdiction === "INTER_STATE") {
      isInterState = true;
    } else if (dto?.jurisdiction === "INTRA_STATE") {
      isInterState = false;
    } else if (companyStateCode && customerStateCode) {
      isInterState = customerStateCode !== companyStateCode;
    }

    // 7. Faithful Multi-Line HSN/SAC & Rate Slab Grouping
    const taxGroupMap = new Map<
      string,
      {
        hsnSacCode: string | null;
        taxRate: number;
        taxableAmount: number;
        totalTaxAmount: number;
      }
    >();

    for (const it of order.items) {
      const hsn = it.product?.hsn?.trim() || null;
      const taxRate = Number(it.taxRate ?? 0);
      const key = `${hsn ?? "NONE"}__${taxRate}`;
      const lineTaxable = round2(Number(it.salesQty) * Number(it.unitPrice));
      const lineTax = round2(lineTaxable * (taxRate / 100));

      const grp = taxGroupMap.get(key) ?? {
        hsnSacCode: hsn,
        taxRate,
        taxableAmount: 0,
        totalTaxAmount: 0,
      };
      grp.taxableAmount = round2(grp.taxableAmount + lineTaxable);
      grp.totalTaxAmount = round2(grp.totalTaxAmount + lineTax);
      taxGroupMap.set(key, grp);
    }

    const taxItems: PostSalesInvoiceTaxItemDto[] = Array.from(
      taxGroupMap.values(),
    ).map((grp) => {
      if (isInterState) {
        return {
          hsnSacCode: grp.hsnSacCode,
          taxableAmount: grp.taxableAmount,
          taxRate: grp.taxRate,
          cgstRate: 0,
          cgstAmount: 0,
          sgstRate: 0,
          sgstAmount: 0,
          igstRate: grp.taxRate,
          igstAmount: grp.totalTaxAmount,
          totalTaxAmount: grp.totalTaxAmount,
        };
      } else {
        const halfTax = round2(grp.totalTaxAmount / 2);
        const halfRate = round2(grp.taxRate / 2);
        return {
          hsnSacCode: grp.hsnSacCode,
          taxableAmount: grp.taxableAmount,
          taxRate: grp.taxRate,
          cgstRate: halfRate,
          cgstAmount: halfTax,
          sgstRate: halfRate,
          sgstAmount: round2(grp.totalTaxAmount - halfTax),
          igstRate: 0,
          igstAmount: 0,
          totalTaxAmount: grp.totalTaxAmount,
        };
      }
    });

    const primaryHsn =
      order.items.find((i) => i.product?.hsn)?.product?.hsn?.trim() || null;
    const maxTaxRate = Math.max(
      ...order.items.map((i) => Number(i.taxRate ?? 0)),
      0,
    );

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;

    if (taxAmount > 0) {
      if (isInterState) {
        igstAmount = taxAmount;
        igstRate = maxTaxRate;
      } else {
        cgstAmount = round2(taxAmount / 2);
        sgstAmount = round2(taxAmount - cgstAmount);
        cgstRate = round2(maxTaxRate / 2);
        sgstRate = round2(maxTaxRate / 2);
      }
    }

    // 8. Invoke Finance & GST Integration Posting
    const postingResult = await this.integrationService.postSalesInvoice(
      {
        invoiceNumber,
        invoiceDate,
        customerId: order.customerId,
        customerName: order.customerName,
        customerGstin: customerGstin || "URP",
        subtotal,
        taxAmount,
        total,
        currency: order.currency,
        hsnSacCode: primaryHsn,
        cgstAmount,
        sgstAmount,
        igstAmount,
        cgstRate,
        sgstRate,
        igstRate,
        taxItems,
        ...((dto?.notes ?? order.notes)
          ? { notes: dto?.notes ?? order.notes }
          : {}),
        salesOrderId: order.id,
      },
      actor,
    );

    return {
      success: true,
      salesOrderId: order.id,
      soNumber: order.soNumber,
      invoiceNumber,
      invoiceDate,
      postingResult,
    };
  }

  /**
   * Cancels a sales order. If an invoice was posted to Finance & GST,
   * automatically triggers journal reversal (REV-) and GST entry cancellation.
   */
  async cancel(id: number) {
    const scope = this.scope;
    const actor = this.actor;

    // Check if an active invoice was issued for this sales order
    const existingGst = await this.prisma.financeGstEntry.findFirst({
      where: {
        organizationId: scope.organizationId,
        sourceType: "SALES_INVOICE",
        sourceId: id,
        status: "ACTIVE",
      },
    });

    if (existingGst) {
      // Reverses GL journal entry and marks GST entries as CANCELLED
      await this.integrationService.cancelSalesInvoice(
        {
          documentReference: existingGst.sourceReference,
          reason: `Sales order cancelled (Order ID: ${id})`,
        },
        actor,
      );
    }

    return this.move(id, ["DRAFT", "CONFIRMED"], "CANCELLED");
  }
}
