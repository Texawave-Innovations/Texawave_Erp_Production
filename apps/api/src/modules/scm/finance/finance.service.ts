import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  detectFileType,
  FileStorageService,
  MAX_UPLOAD_BYTES,
} from "../../../shared/file-storage/file-storage.service.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { SalesPurchasesIntegrationService } from "../../finance/integration/sales-purchases-integration.service.js";
import type {
  PostPurchaseBillDto,
  PostPurchaseBillTaxItemDto,
} from "../../finance/integration/dto/post-purchase-bill.dto.js";
import { SuppliersService } from "../suppliers/suppliers.service.js";
import type {
  CreateBillDto,
  CreatePaymentDto,
  PostBillToFinanceDto,
  QueryBillDto,
  QueryPaymentDto,
  UpdateBillDto,
  UploadSupplierDocumentDto,
} from "./dto/finance.dto.js";
import { FinanceRepository } from "./finance.repository.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface UploadedSupplierFile {
  buffer: Buffer;
  size: number;
  originalname: string;
}

/** Keeps the uploader's own file name for display, minus any path or control
 * characters (same rule as the HR employee-documents upload). */
function sanitizeFileName(name: string): string {
  const base = [...path.basename(name)]
    .filter((char) => char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) !== 0x7f)
    .join("")
    .trim();
  return (base || "document").slice(0, 255);
}

/** Supplier finance: Accounts Payable bills, payments made, and supplier
 * documents (legacy supplier detail tabs "Bills", "Payments", "Documents"). */
@Injectable()
export class FinanceService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly suppliers: SuppliersService,
    private readonly tenantContext: TenantContextService,
    private readonly files: FileStorageService,
    private readonly integration: SalesPurchasesIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  // ---- bills ------------------------------------------------------------------

  async listBills(query: QueryBillDto) {
    const { items, total } = await this.repo.findBills(
      this.scope,
      {
        q: query.q,
        status: query.status,
        supplierId: query.supplierId,
        overdue: query.overdue === "true" ? true : undefined,
      },
      query,
    );

    if (items.length > 0) {
      const refs = items.flatMap((b) => {
        const r: string[] = [];
        if (b.supplierBillNumber?.trim()) r.push(b.supplierBillNumber.trim());
        if (b.billNumber?.trim()) r.push(b.billNumber.trim());
        return r;
      });

      const [postedJournals, activeGstEntries] = await Promise.all([
        this.prisma.financeJournalEntry.findMany({
          where: {
            organizationId: this.scope.organizationId,
            referenceNumber: { in: refs },
            status: "POSTED",
          },
          select: {
            id: true,
            entryNumber: true,
            referenceNumber: true,
            postedAt: true,
          },
        }),
        this.prisma.financeGstEntry.findMany({
          where: {
            organizationId: this.scope.organizationId,
            sourceReference: { in: refs },
            status: "ACTIVE",
          },
          select: {
            id: true,
            sourceReference: true,
          },
        }),
      ]);

      const journalByRef = new Map(
        postedJournals.map((j) => [j.referenceNumber, j]),
      );
      const gstByRef = new Map(
        activeGstEntries.map((g) => [g.sourceReference, g]),
      );

      const enriched = items.map((b) => {
        const prefRef = b.supplierBillNumber?.trim() || b.billNumber.trim();
        const altRef = b.billNumber.trim();
        const journal = journalByRef.get(prefRef) || journalByRef.get(altRef);
        const gst = gstByRef.get(prefRef) || gstByRef.get(altRef);

        return {
          ...b,
          isPosted: !!journal,
          journalEntryId: journal?.id ?? null,
          journalEntryNumber: journal?.entryNumber ?? null,
          gstEntryId: gst?.id ?? null,
          postedAt: journal?.postedAt?.toISOString() ?? null,
        };
      });

      return new PaginatedResponseDto(enriched, total, query.page, query.limit);
    }

    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async getBill(id: number) {
    const row = await this.repo.findBill(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Bill", id);

    const prefRef = row.supplierBillNumber?.trim() || row.billNumber.trim();
    const altRef = row.billNumber.trim();

    const [journal, gst] = await Promise.all([
      this.prisma.financeJournalEntry.findFirst({
        where: {
          organizationId: this.scope.organizationId,
          referenceNumber: { in: [prefRef, altRef] },
          status: "POSTED",
        },
        select: {
          id: true,
          entryNumber: true,
          postedAt: true,
        },
      }),
      this.prisma.financeGstEntry.findFirst({
        where: {
          organizationId: this.scope.organizationId,
          sourceReference: { in: [prefRef, altRef] },
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      }),
    ]);

    return {
      ...row,
      isPosted: !!journal,
      journalEntryId: journal?.id ?? null,
      journalEntryNumber: journal?.entryNumber ?? null,
      gstEntryId: gst?.id ?? null,
      postedAt: journal?.postedAt?.toISOString() ?? null,
    };
  }

  createBill(dto: CreateBillDto) {
    return this.repo.createBill(this.scope, dto, this.actor);
  }

  async updateBill(id: number, dto: UpdateBillDto) {
    const row = await this.repo.updateBill(this.scope, id, dto, this.actor);
    if (!row) throw new ResourceNotFoundException("Bill", id);
    return row;
  }

  async postBillToFinance(id: number, dto?: PostBillToFinanceDto) {
    const bill = await this.repo.findBillForPosting(this.scope, id);
    if (!bill) throw new ResourceNotFoundException("Bill", id);

    if (bill.status === "CANCELLED") {
      throw new BusinessRuleViolationException(
        "A cancelled bill cannot be posted to Finance.",
        "BILL_CANCELLED",
      );
    }

    // 1. Determine Tax Jurisdiction (Intra-state vs Inter-state)
    let jurisdiction: "INTRA_STATE" | "INTER_STATE" = "INTRA_STATE";
    if (dto?.jurisdiction) {
      jurisdiction = dto.jurisdiction;
    } else {
      const payroll = await this.prisma.payrollSetting.findFirst({
        where: { organizationId: this.scope.organizationId },
        select: { companyGstin: true },
      });
      const companyGstin = payroll?.companyGstin?.trim().toUpperCase();
      const companyStateCode =
        companyGstin && companyGstin.length >= 2
          ? companyGstin.slice(0, 2)
          : null;
      const supplierGstin = bill.supplier?.gstin?.trim().toUpperCase();
      const supplierStateCode =
        supplierGstin && supplierGstin.length >= 2
          ? supplierGstin.slice(0, 2)
          : null;

      if (
        companyStateCode &&
        supplierStateCode &&
        companyStateCode.length === 2 &&
        supplierStateCode.length === 2
      ) {
        jurisdiction =
          companyStateCode === supplierStateCode
            ? "INTRA_STATE"
            : "INTER_STATE";
      } else {
        jurisdiction = "INTRA_STATE";
      }
    }

    // 2. Tax Components & Multi-line breakdown
    const isInterState = jurisdiction === "INTER_STATE";
    const subtotal = Number(bill.subtotal);
    const taxAmount = Number(bill.taxAmount);
    const total = Number(bill.total);
    const isItcEligible = dto?.isItcEligible ?? true;

    let taxItems: PostPurchaseBillTaxItemDto[] | undefined;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const poItems = bill.purchaseOrder?.items;
    if (poItems && poItems.length > 0 && taxAmount > 0) {
      // Group items by (hsn, taxRate)
      const groupMap = new Map<
        string,
        {
          hsnSacCode: string | null;
          taxRate: number;
          taxableAmount: number;
          totalTaxAmount: number;
        }
      >();

      for (const item of poItems) {
        const hsn = item.product?.hsn?.trim() || null;
        const rate = Number(item.taxRate ?? 0);
        const qty = Number(item.quantity);
        const price = Number(item.unitPrice);
        const lineTaxable = round2(qty * price);
        const lineTax =
          Number(item.taxAmount) > 0
            ? Number(item.taxAmount)
            : round2(lineTaxable * (rate / 100));

        const key = `${hsn ?? "NONE"}_${rate}`;
        const existing = groupMap.get(key);
        if (existing) {
          existing.taxableAmount = round2(existing.taxableAmount + lineTaxable);
          existing.totalTaxAmount = round2(existing.totalTaxAmount + lineTax);
        } else {
          groupMap.set(key, {
            hsnSacCode: hsn,
            taxRate: rate,
            taxableAmount: lineTaxable,
            totalTaxAmount: lineTax,
          });
        }
      }

      const groups = Array.from(groupMap.values());
      const sumGroupTax = round2(
        groups.reduce((acc, g) => acc + g.totalTaxAmount, 0),
      );

      // If grouped taxes closely align with the bill's tax amount, use detailed breakdown
      if (Math.abs(sumGroupTax - taxAmount) <= 1.0) {
        taxItems = groups.map((g) => {
          if (isInterState) {
            return {
              hsnSacCode: g.hsnSacCode,
              taxableAmount: g.taxableAmount,
              taxRate: g.taxRate,
              cgstRate: 0,
              cgstAmount: 0,
              sgstRate: 0,
              sgstAmount: 0,
              igstRate: g.taxRate,
              igstAmount: g.totalTaxAmount,
              totalTaxAmount: g.totalTaxAmount,
            };
          } else {
            const halfRate = round2(g.taxRate / 2);
            const halfTax = round2(g.totalTaxAmount / 2);
            const remainderTax = round2(g.totalTaxAmount - halfTax);
            return {
              hsnSacCode: g.hsnSacCode,
              taxableAmount: g.taxableAmount,
              taxRate: g.taxRate,
              cgstRate: halfRate,
              cgstAmount: halfTax,
              sgstRate: halfRate,
              sgstAmount: remainderTax,
              igstRate: 0,
              igstAmount: 0,
              totalTaxAmount: g.totalTaxAmount,
            };
          }
        });

        cgstAmount = round2(
          taxItems.reduce((acc, t) => acc + (t.cgstAmount ?? 0), 0),
        );
        sgstAmount = round2(
          taxItems.reduce((acc, t) => acc + (t.sgstAmount ?? 0), 0),
        );
        igstAmount = round2(
          taxItems.reduce((acc, t) => acc + (t.igstAmount ?? 0), 0),
        );
      }
    }

    if (!taxItems || taxItems.length === 0) {
      if (taxAmount > 0) {
        if (isInterState) {
          igstAmount = taxAmount;
          cgstAmount = 0;
          sgstAmount = 0;
        } else {
          cgstAmount = round2(taxAmount / 2);
          sgstAmount = round2(taxAmount - cgstAmount);
          igstAmount = 0;
        }
      }
    }

    const postPayload: PostPurchaseBillDto = {
      billNumber: bill.billNumber,
      billDate: bill.billDate.toISOString().slice(0, 10),
      supplierId: bill.supplierId,
      supplierName: bill.supplier.companyName,
      subtotal,
      taxAmount,
      total,
      currency: bill.currency,
      cgstAmount,
      sgstAmount,
      igstAmount,
      isItcEligible,
      ...(bill.supplierBillNumber
        ? { supplierBillNumber: bill.supplierBillNumber }
        : {}),
      ...(bill.supplier?.gstin ? { supplierGstin: bill.supplier.gstin } : {}),
      ...(taxItems?.[0]?.hsnSacCode
        ? { hsnSacCode: taxItems[0].hsnSacCode }
        : {}),
      ...(taxItems && taxItems.length > 0 ? { taxItems } : {}),
      ...(dto?.notes?.trim() || bill.notes?.trim()
        ? { notes: dto?.notes?.trim() || bill.notes?.trim() }
        : {}),
      ...(bill.purchaseOrderId
        ? { purchaseOrderId: bill.purchaseOrderId }
        : {}),
    };

    const result = await this.integration.postPurchaseBill(
      postPayload,
      this.actor,
    );

    return result;
  }

  async cancelBill(id: number, reason: string) {
    const bill = await this.repo.findBill(this.scope, id);
    if (!bill) throw new ResourceNotFoundException("Bill", id);

    const ref = bill.supplierBillNumber?.trim() || bill.billNumber.trim();

    // 1. If previously posted, reverse the accounting and GST entries
    await this.integration.cancelPurchaseBill(
      { documentReference: ref, reason },
      this.actor,
    );

    // 2. Cancel the bill in SCM
    const row = await this.repo.cancelBill(this.scope, id, reason, this.actor);
    return row;
  }

  async supplierSummary(supplierId: number) {
    await this.suppliers.findOne(supplierId);
    return this.repo.supplierSummary(this.scope, supplierId);
  }

  // ---- payments ---------------------------------------------------------------

  async listPayments(query: QueryPaymentDto) {
    const { items, total } = await this.repo.findPayments(
      this.scope,
      {
        q: query.q,
        supplierId: query.supplierId,
        billId: query.billId,
        status: query.status,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  createPayment(dto: CreatePaymentDto) {
    return this.repo.createPayment(this.scope, dto, this.actor);
  }

  async voidPayment(id: number, reason: string) {
    const row = await this.repo.voidPayment(this.scope, id, reason, this.actor);
    if (!row) throw new ResourceNotFoundException("Payment", id);
    return row;
  }

  // ---- documents ---------------------------------------------------------------

  /** Never returns the internal storage key. */
  async listDocuments(supplierId: number) {
    await this.suppliers.findOne(supplierId);
    const rows = await this.repo.listDocuments(this.scope, supplierId);
    return rows.map(({ storageKey: _omit, ...rest }) => rest);
  }

  async uploadDocument(
    supplierId: number,
    dto: UploadSupplierDocumentDto,
    file: UploadedSupplierFile | undefined,
  ) {
    if (!file) throw new BadRequestException("Choose a file to upload.");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException("File must be 5 MB or smaller.");
    }
    const detected = detectFileType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        "Only PDF, JPG, or PNG files are accepted.",
      );
    }
    await this.suppliers.findOne(supplierId);

    const fileName = sanitizeFileName(file.originalname);
    const storageKey = `scm-suppliers/${supplierId}/${randomUUID()}.${detected.extension}`;
    await this.files.save(storageKey, file.buffer);
    try {
      const row = await this.repo.createDocument(
        this.scope,
        {
          supplierId,
          name: dto.name?.trim() || fileName,
          documentType: dto.documentType ?? null,
          fileName,
          storageKey,
          mimeType: detected.mimeType,
          sizeBytes: file.size,
        },
        this.actor,
      );
      const { storageKey: _omit, ...metadata } = row;
      return metadata;
    } catch (error) {
      await this.files.remove(storageKey);
      throw error;
    }
  }

  async downloadDocument(supplierId: number, id: number) {
    const row = await this.repo.findDocument(this.scope, supplierId, id);
    if (!row) throw new ResourceNotFoundException("Document", id);
    return {
      buffer: await this.files.read(row.storageKey),
      mimeType: row.mimeType,
      fileName: row.fileName,
    };
  }

  async removeDocument(supplierId: number, id: number) {
    const row = await this.repo.softDeleteDocument(this.scope, supplierId, id);
    if (!row) throw new ResourceNotFoundException("Document", id);
    await this.files.remove(row.storageKey);
  }
}
