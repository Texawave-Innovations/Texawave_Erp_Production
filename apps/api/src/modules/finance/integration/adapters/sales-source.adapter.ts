import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  ISalesTransactionSource,
  SalesTaxLine,
  SalesTaxTransaction,
  TaxTransactionQuery,
} from "../contracts/sales-transaction.contract.js";

function round2(val: number): number {
  return Number(Number(val).toFixed(2));
}

@Injectable()
export class SalesSourceAdapter implements ISalesTransactionSource {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves posted sales tax transactions.
   * Merges authoritative Sales Orders (when present in branch) with the Finance GST ledger.
   * Ensures organization isolation, date filtering, and status filtering.
   */
  async getPostedSalesTransactions(
    scope: OrgScope,
    query: TaxTransactionQuery,
  ): Promise<SalesTaxTransaction[]> {
    const results: SalesTaxTransaction[] = [];
    const seenReferences = new Set<string>();

    // 1. Fetch from SCM Sales Orders (if available in this branch)
    try {
      const soWhere: Prisma.ScmSalesOrderWhereInput = {
        organizationId: scope.organizationId,
        status: { notIn: ["CANCELLED", "DRAFT"] },
      };

      if (query.period) {
        // e.g. "2026-10"
        const start = new Date(`${query.period}-01T00:00:00.000Z`);
        const [year, month] = query.period.split("-").map(Number);
        const end = new Date(Date.UTC(year!, month!, 0, 23, 59, 59, 999));
        soWhere.orderDate = { gte: start, lte: end };
      } else if (query.startDate && query.endDate) {
        soWhere.orderDate = {
          gte: new Date(`${query.startDate}T00:00:00.000Z`),
          lte: new Date(`${query.endDate}T23:59:59.999Z`),
        };
      }

      const salesOrders = await this.prisma.scmSalesOrder.findMany({
        where: soWhere,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
        },
        orderBy: { orderDate: "desc" },
      });

      for (const so of salesOrders) {
        const fallbackSo = so as unknown as {
          orderNumber?: string;
          totalAmount?: number | string;
        };
        const ref = so.soNumber || fallbackSo.orderNumber || `SO-${so.id}`;
        seenReferences.add(ref.toUpperCase());

        const lines: SalesTaxLine[] = so.items.map((it, idx) => {
          const qty = Number(it.salesQty);
          const price = Number(it.unitPrice);
          const lineTaxable = round2(qty * price);
          const taxRate = Number(it.taxRate ?? 0);
          const fallbackIt = it as unknown as {
            taxAmount?: number | string;
            description?: string;
          };
          const totalTax = round2(
            Number(fallbackIt.taxAmount ?? (lineTaxable * taxRate) / 100),
          );
          const halfTax = round2(totalTax / 2);

          const desc =
            it.itemDescription ||
            fallbackIt.description ||
            it.product?.name ||
            "Sales Item";

          return {
            lineOrder: idx,
            productId: it.productId,
            productName: it.product?.name ?? desc,
            description: desc,
            hsnSacCode: it.product?.hsn?.trim() || null,
            quantity: qty,
            uom: it.product?.uom ?? it.uom ?? "PCS",
            unitPrice: price,
            taxableAmount: lineTaxable,
            taxRate,
            cgstRate: round2(taxRate / 2),
            cgstAmount: halfTax,
            sgstRate: round2(taxRate / 2),
            sgstAmount: round2(totalTax - halfTax),
            igstRate: 0,
            igstAmount: 0,
            totalTaxAmount: totalTax,
          };
        });

        const subtotal = round2(Number(so.subtotal ?? 0));
        const taxAmount = round2(Number(so.taxAmount ?? 0));
        const total = round2(
          Number(so.total ?? fallbackSo.totalAmount ?? subtotal + taxAmount),
        );

        results.push({
          id: so.id,
          documentNumber: ref,
          documentDate: so.orderDate.toISOString().slice(0, 10),
          period: so.orderDate.toISOString().slice(0, 7),
          status: "POSTED",
          customerId: so.customerId,
          customerName: so.customer?.name ?? so.customerName ?? "Customer",
          customerGstin: so.customer?.gstin ?? null,
          isB2B: Boolean(so.customer?.gstin && so.customer.gstin.length === 15),
          placeOfSupply: so.customer?.gstin
            ? so.customer.gstin.slice(0, 2)
            : null,
          isInterState: false,
          currency: so.currency || "INR",
          subtotal,
          taxAmount,
          totalAmount: total,
          isProformaExcluded: false,
          lines,
        });
      }
    } catch {
      // ScmSalesOrder model may not be populated or table empty in this branch
    }

    // 2. Fetch from Finance GST Ledger (covers all direct posted sales invoices)
    const gstWhere: Prisma.FinanceGstEntryWhereInput = {
      organizationId: scope.organizationId,
      entryType: "OUTPUT_GST",
      status: { not: "CANCELLED" },
    };

    if (query.period) {
      gstWhere.period = query.period;
    } else if (query.startDate && query.endDate) {
      gstWhere.createdAt = {
        gte: new Date(`${query.startDate}T00:00:00.000Z`),
        lte: new Date(`${query.endDate}T23:59:59.999Z`),
      };
    }

    const gstEntries = await this.prisma.financeGstEntry.findMany({
      where: tenantWhere<Prisma.FinanceGstEntryWhereInput>(scope, gstWhere),
      orderBy: { createdAt: "desc" },
    });

    for (const entry of gstEntries) {
      const ref = entry.sourceReference.trim();
      // Prevent double counting if already loaded from ScmSalesOrder
      if (seenReferences.has(ref.toUpperCase())) {
        continue;
      }
      seenReferences.add(ref.toUpperCase());

      const taxable = Number(entry.taxableAmount);
      const cgst = Number(entry.cgstAmount);
      const sgst = Number(entry.sgstAmount);
      const igst = Number(entry.igstAmount);
      const tax = Number(entry.totalTaxAmount);

      const isInterState = igst > 0;
      const combinedRate =
        Number(entry.cgstRate) +
        Number(entry.sgstRate) +
        Number(entry.igstRate);

      results.push({
        id: entry.id,
        documentNumber: ref,
        documentDate: entry.createdAt.toISOString().slice(0, 10),
        period: entry.period,
        status: "POSTED",
        customerName: entry.sourceReference,
        customerGstin: entry.gstin,
        isB2B: Boolean(
          entry.gstin &&
          entry.gstin.length === 15 &&
          !entry.gstin.startsWith("URP"),
        ),
        placeOfSupply:
          entry.gstin && entry.gstin.length >= 2
            ? entry.gstin.slice(0, 2)
            : null,
        isInterState,
        currency: "INR",
        subtotal: taxable,
        taxAmount: tax,
        totalAmount: round2(taxable + tax),
        isProformaExcluded: entry.isProformaExcluded,
        lines: [
          {
            lineOrder: 0,
            description: `Sales Supply: ${ref}`,
            hsnSacCode: entry.hsnSacCode,
            quantity: 1,
            uom: "PCS",
            unitPrice: taxable,
            taxableAmount: taxable,
            taxRate: combinedRate,
            cgstRate: Number(entry.cgstRate),
            cgstAmount: cgst,
            sgstRate: Number(entry.sgstRate),
            sgstAmount: sgst,
            igstRate: Number(entry.igstRate),
            igstAmount: igst,
            totalTaxAmount: tax,
          },
        ],
      });
    }

    return results;
  }

  async getSalesTransactionByReference(
    scope: OrgScope,
    reference: string,
  ): Promise<SalesTaxTransaction | null> {
    const list = await this.getPostedSalesTransactions(scope, {
      search: reference,
    });
    return (
      list.find(
        (it) =>
          it.documentNumber.toUpperCase() === reference.trim().toUpperCase(),
      ) ?? null
    );
  }
}
