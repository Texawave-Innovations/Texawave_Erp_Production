import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  IPurchasesTransactionSource,
  PurchaseTaxLine,
  PurchaseTaxTransaction,
} from "../contracts/purchases-transaction.contract.js";
import type { TaxTransactionQuery } from "../contracts/sales-transaction.contract.js";

function round2(val: number): number {
  return Number(Number(val).toFixed(2));
}

@Injectable()
export class PurchasesSourceAdapter implements IPurchasesTransactionSource {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves inward purchase tax transactions (Supplier Bills & Qualifying Expenses).
   *
   * Statutory Rule: Purchase Orders (PO) alone are unfulfilled commitments and are NEVER
   * treated as eligible ITC claims. Only completed supplier bills and paid qualifying
   * expenses constitute valid inward transactions.
   */
  async getInwardTaxTransactions(
    scope: OrgScope,
    query: TaxTransactionQuery,
  ): Promise<PurchaseTaxTransaction[]> {
    const results: PurchaseTaxTransaction[] = [];
    const seenReferences = new Set<string>();

    // 1. Fetch from SCM Supplier Bills (confirmed inward vendor tax invoices)
    try {
      const billWhere: Prisma.ScmSupplierBillWhereInput = {
        organizationId: scope.organizationId,
        status: { notIn: ["CANCELLED", "DRAFT"] },
      };

      if (query.period) {
        const start = new Date(`${query.period}-01T00:00:00.000Z`);
        const [year, month] = query.period.split("-").map(Number);
        const end = new Date(Date.UTC(year!, month!, 0, 23, 59, 59, 999));
        billWhere.billDate = { gte: start, lte: end };
      } else if (query.startDate && query.endDate) {
        billWhere.billDate = {
          gte: new Date(`${query.startDate}T00:00:00.000Z`),
          lte: new Date(`${query.endDate}T23:59:59.999Z`),
        };
      }

      const bills = await this.prisma.scmSupplierBill.findMany({
        where: billWhere,
        include: {
          supplier: true,
          purchaseOrder: {
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
        orderBy: { billDate: "desc" },
      });

      for (const bill of bills) {
        const ref = bill.supplierBillNumber?.trim() || bill.billNumber.trim();
        seenReferences.add(ref.toUpperCase());

        const subtotal = round2(Number(bill.subtotal ?? 0));
        const taxAmount = round2(Number(bill.taxAmount ?? 0));
        const fallbackBill = bill as unknown as {
          totalAmount?: number | string;
          isItcEligible?: boolean;
        };
        const total = round2(
          Number(
            bill.total ?? fallbackBill.totalAmount ?? subtotal + taxAmount,
          ),
        );
        const isItcEligible = Boolean(
          bill.supplier?.gstin &&
          bill.supplier.gstin.length === 15 &&
          fallbackBill.isItcEligible !== false,
        );

        const lines: PurchaseTaxLine[] = [];
        if (bill.purchaseOrder?.items && bill.purchaseOrder.items.length > 0) {
          bill.purchaseOrder.items.forEach((it, idx) => {
            const qty = Number(it.quantity);
            const price = Number(it.unitPrice);
            const lineTaxable = round2(qty * price);
            const taxRate = Number(it.taxRate ?? 0);
            const lineTax = round2(
              Number(it.taxAmount ?? (lineTaxable * taxRate) / 100),
            );
            const halfTax = round2(lineTax / 2);

            lines.push({
              lineOrder: idx,
              productId: it.productId,
              productName: it.product?.name ?? "Purchased Item",
              description: it.product?.description ?? "Supplier Item",
              hsnSacCode: it.product?.hsn?.trim() || null,
              quantity: qty,
              uom: it.product?.uom ?? "PCS",
              unitPrice: price,
              taxableAmount: lineTaxable,
              taxRate,
              cgstRate: round2(taxRate / 2),
              cgstAmount: halfTax,
              sgstRate: round2(taxRate / 2),
              sgstAmount: round2(lineTax - halfTax),
              igstRate: 0,
              igstAmount: 0,
              totalTaxAmount: lineTax,
              isItcEligible,
            });
          });
        } else {
          // Default single line if line items not partitioned
          const halfTax = round2(taxAmount / 2);
          lines.push({
            lineOrder: 0,
            description: `Supplier Inward: ${ref}`,
            quantity: 1,
            unitPrice: subtotal,
            taxableAmount: subtotal,
            taxRate: subtotal > 0 ? round2((taxAmount / subtotal) * 100) : 0,
            cgstAmount: halfTax,
            sgstAmount: round2(taxAmount - halfTax),
            igstAmount: 0,
            totalTaxAmount: taxAmount,
            isItcEligible,
          });
        }

        results.push({
          id: bill.id,
          documentNumber: bill.billNumber,
          supplierBillNumber: bill.supplierBillNumber,
          documentDate: bill.billDate.toISOString().slice(0, 10),
          period: bill.billDate.toISOString().slice(0, 7),
          status: "POSTED",
          supplierId: bill.supplierId,
          supplierName: bill.supplier?.companyName ?? "Unknown Supplier",
          supplierGstin: bill.supplier?.gstin ?? null,
          isRegisteredVendor: Boolean(
            bill.supplier?.gstin && bill.supplier.gstin.length === 15,
          ),
          placeOfSupply: bill.supplier?.gstin
            ? bill.supplier.gstin.slice(0, 2)
            : null,
          isInterState: false,
          currency: bill.currency || "INR",
          subtotal,
          taxAmount,
          totalAmount: total,
          isItcEligible,
          inwardSourceType: "SUPPLIER_BILL",
          lines,
        });
      }
    } catch {
      // ScmSupplierBill table may not be populated
    }

    // 2. Fetch from Qualifying Paid Finance Expenses with Vendor GSTIN
    try {
      const expWhere: Prisma.FinanceExpenseWhereInput = {
        organizationId: scope.organizationId,
        status: "PAID",
        taxAmount: { gt: 0 },
        vendorGstin: { not: null },
      };

      if (query.period) {
        const start = new Date(`${query.period}-01T00:00:00.000Z`);
        const [year, month] = query.period.split("-").map(Number);
        const end = new Date(Date.UTC(year!, month!, 0, 23, 59, 59, 999));
        expWhere.expenseDate = { gte: start, lte: end };
      } else if (query.startDate && query.endDate) {
        expWhere.expenseDate = {
          gte: new Date(`${query.startDate}T00:00:00.000Z`),
          lte: new Date(`${query.endDate}T23:59:59.999Z`),
        };
      }

      const expenses = await this.prisma.financeExpense.findMany({
        where: expWhere,
        orderBy: { expenseDate: "desc" },
      });

      for (const exp of expenses) {
        const ref = exp.expenseNumber;
        seenReferences.add(ref.toUpperCase());

        const fallback = exp as unknown as {
          totalAmount?: number | string;
          referenceNumber?: string;
          payee?: string;
          description?: string;
        };
        const subtotal = round2(Number(exp.amount));
        const taxAmount = round2(Number(exp.taxAmount ?? 0));
        const total = round2(
          Number(exp.netAmount ?? fallback.totalAmount ?? subtotal + taxAmount),
        );
        const cgst = round2(Number(exp.cgstAmount ?? taxAmount / 2));
        const sgst = round2(Number(exp.sgstAmount ?? taxAmount - cgst));
        const igst = round2(Number(exp.igstAmount ?? 0));
        const isItcEligible = Boolean(exp.isItcEligible && exp.vendorGstin);

        results.push({
          id: exp.id,
          documentNumber: ref,
          supplierBillNumber:
            exp.vendorInvoiceNumber ?? fallback.referenceNumber ?? null,
          documentDate: exp.expenseDate.toISOString().slice(0, 10),
          period: exp.expenseDate.toISOString().slice(0, 7),
          status: "PAID",
          supplierName: exp.vendorName ?? fallback.payee ?? "Expense Payee",
          supplierGstin: exp.vendorGstin,
          isRegisteredVendor: Boolean(
            exp.vendorGstin && exp.vendorGstin.length === 15,
          ),
          placeOfSupply:
            exp.vendorGstin && exp.vendorGstin.length >= 2
              ? exp.vendorGstin.slice(0, 2)
              : null,
          isInterState: igst > 0,
          currency: "INR",
          subtotal,
          taxAmount,
          totalAmount: total,
          isItcEligible,
          inwardSourceType: "EXPENSE",
          lines: [
            {
              lineOrder: 0,
              description:
                exp.notes ||
                fallback.description ||
                `Operational Expense ${ref}`,
              hsnSacCode: exp.hsnSacCode,
              quantity: 1,
              uom: "OTH",
              unitPrice: subtotal,
              taxableAmount: subtotal,
              taxRate: subtotal > 0 ? round2((taxAmount / subtotal) * 100) : 0,
              cgstAmount: cgst,
              sgstAmount: sgst,
              igstAmount: igst,
              totalTaxAmount: taxAmount,
              isItcEligible,
            },
          ],
        });
      }
    } catch {
      // FinanceExpense may have no matching qualifying records
    }

    // 3. Fetch from Finance GST Ledger (covers all direct posted ITC records)
    const gstWhere: Prisma.FinanceGstEntryWhereInput = {
      organizationId: scope.organizationId,
      entryType: "INPUT_TAX_CREDIT",
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
        supplierBillNumber: ref,
        documentDate: entry.createdAt.toISOString().slice(0, 10),
        period: entry.period,
        status: "POSTED",
        supplierName: entry.sourceReference,
        supplierGstin: entry.gstin,
        isRegisteredVendor: Boolean(
          entry.gstin &&
          entry.gstin.length === 15 &&
          !entry.gstin.startsWith("UNREGISTERED"),
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
        isItcEligible: true, // ledger entries created as INPUT_TAX_CREDIT are deemed eligible
        inwardSourceType: "SUPPLIER_BILL",
        lines: [
          {
            lineOrder: 0,
            description: `Inward Purchase Supply: ${ref}`,
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
            isItcEligible: true,
          },
        ],
      });
    }

    return results;
  }

  async getPurchaseTransactionByReference(
    scope: OrgScope,
    reference: string,
  ): Promise<PurchaseTaxTransaction | null> {
    const list = await this.getInwardTaxTransactions(scope, {
      search: reference,
    });
    return (
      list.find(
        (it) =>
          it.documentNumber.toUpperCase() === reference.trim().toUpperCase() ||
          it.supplierBillNumber?.toUpperCase() ===
            reference.trim().toUpperCase(),
      ) ?? null
    );
  }
}
