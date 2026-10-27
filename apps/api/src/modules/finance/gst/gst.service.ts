import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { CreateGstEntryDto } from "./dto/create-gst-entry.dto.js";
import type { QueryGstEntriesDto } from "./dto/query-gst-entries.dto.js";
import type { QueryGstr1Dto } from "./dto/query-gstr1.dto.js";
import type { QueryGstr3bDto } from "./dto/query-gstr3b.dto.js";
import type { QueryHsnSummaryDto } from "./dto/query-hsn-summary.dto.js";
import type { ReconcileGstDto } from "./dto/reconcile-gst.dto.js";
import { GstRepository } from "./gst.repository.js";
import type {
  FinanceGstr1SummaryReport,
  FinanceGstr3bSummaryReport,
  FinanceHsnSummaryReport,
  FinanceGstReconciliationResult,
  GstReconciliationDiscrepancyItem,
  Gstr1RateBucket,
  HsnSummaryItem,
} from "./gst.types.js";

@Injectable()
export class GstService {
  constructor(
    private readonly repository: GstRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Records a GST tax ledger entry (outward liability or inward ITC).
   * Validates monetary component arithmetic and auto-detects proforma invoices.
   */
  async createEntry(dto: CreateGstEntryDto, userId?: number) {
    const scope = this.tenantContext.getOrgScope();

    const cgstAmount = Number((dto.cgstAmount ?? 0).toFixed(2));
    const sgstAmount = Number((dto.sgstAmount ?? 0).toFixed(2));
    const igstAmount = Number((dto.igstAmount ?? 0).toFixed(2));
    const sumTax = Number((cgstAmount + sgstAmount + igstAmount).toFixed(2));

    let totalTaxAmount =
      dto.totalTaxAmount !== undefined
        ? Number(dto.totalTaxAmount.toFixed(2))
        : sumTax;

    // Validate tax arithmetic if totalTaxAmount was explicitly provided
    if (dto.totalTaxAmount !== undefined) {
      const diff = Math.abs(sumTax - totalTaxAmount);
      if (diff > 0.02) {
        throw new BusinessRuleViolationException(
          `Sum of CGST (${cgstAmount}), SGST (${sgstAmount}), and IGST (${igstAmount}) does not equal totalTaxAmount (${totalTaxAmount})`,
          "GST_COMPONENT_MISMATCH",
        );
      }
    } else {
      totalTaxAmount = sumTax;
    }

    // Auto-detect proforma exclusion rule if not explicitly set
    let isProformaExcluded = dto.isProformaExcluded ?? false;
    if (dto.isProformaExcluded === undefined) {
      const ref = dto.sourceReference.toUpperCase();
      if (
        ref.includes("/PI/") ||
        ref.includes("-PI-") ||
        ref.startsWith("PI-") ||
        ref.includes("PROFORMA")
      ) {
        isProformaExcluded = true;
      }
    }

    // Idempotency check: prevent duplicate active GST entries for the same reference and counterparty
    if (this.repository.findByReference) {
      const existing = await this.repository.findByReference(
        scope,
        dto.period,
        dto.sourceReference.trim(),
        dto.gstin.trim().toUpperCase(),
        dto.entryType,
      );
      if (existing) {
        return existing;
      }
    }

    const created = await this.repository.create(scope, {
      gstin: dto.gstin.trim().toUpperCase(),
      period: dto.period,
      entryType: dto.entryType,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId ?? null,
      sourceReference: dto.sourceReference.trim(),
      hsnSacCode: dto.hsnSacCode ? dto.hsnSacCode.trim() : null,
      taxableAmount: dto.taxableAmount,
      cgstRate: dto.cgstRate ?? 0,
      cgstAmount,
      sgstRate: dto.sgstRate ?? 0,
      sgstAmount,
      igstRate: dto.igstRate ?? 0,
      igstAmount,
      totalTaxAmount,
      isProformaExcluded,
      createdBy: userId ?? null,
    });

    return created;
  }

  /**
   * Retrieves paginated GST entries with filter support.
   */
  async getEntries(query: QueryGstEntriesDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(scope, query);
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /**
   * Retrieves a single GST entry by ID.
   */
  async getEntryById(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const entry = await this.repository.findById(scope, id);
    if (!entry) {
      throw new ResourceNotFoundException("FinanceGstEntry", id);
    }
    return entry;
  }

  /**
   * HSN/SAC Summary Report.
   * Groups active GST transactions by HSN/SAC code with aggregated taxable & tax amounts.
   */
  async getHsnSummary(
    query: QueryHsnSummaryDto,
  ): Promise<FinanceHsnSummaryReport> {
    const scope = this.tenantContext.getOrgScope();

    let entries;
    if (query.period) {
      entries = await this.repository.getPeriodEntries(
        scope,
        query.period,
        query.entryType,
      );
    } else if (query.startDate && query.endDate) {
      const start = new Date(`${query.startDate}T00:00:00.000Z`);
      const end = new Date(`${query.endDate}T23:59:59.999Z`);
      entries = await this.repository.getEntriesByDateRange(
        scope,
        start,
        end,
        query.entryType,
      );
    } else {
      const defaultPeriod = new Date().toISOString().slice(0, 7);
      entries = await this.repository.getPeriodEntries(
        scope,
        defaultPeriod,
        query.entryType,
      );
    }

    // Filter out proforma invoices and cancelled records
    const eligible = entries.filter(
      (e) => !e.isProformaExcluded && e.status !== "CANCELLED",
    );

    const hsnMap = new Map<string, HsnSummaryItem>();
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalTax = 0;

    for (const e of eligible) {
      const code = e.hsnSacCode || "UNCLASSIFIED";
      const taxable = Number(e.taxableAmount);
      const cgst = Number(e.cgstAmount);
      const sgst = Number(e.sgstAmount);
      const igst = Number(e.igstAmount);
      const tax = Number(e.totalTaxAmount);

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
      totalTax += tax;

      const item = hsnMap.get(code) ?? {
        hsnSacCode: code,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTaxAmount: 0,
        transactionCount: 0,
      };

      item.taxableAmount = Number((item.taxableAmount + taxable).toFixed(2));
      item.cgstAmount = Number((item.cgstAmount + cgst).toFixed(2));
      item.sgstAmount = Number((item.sgstAmount + sgst).toFixed(2));
      item.igstAmount = Number((item.igstAmount + igst).toFixed(2));
      item.totalTaxAmount = Number((item.totalTaxAmount + tax).toFixed(2));
      item.transactionCount += 1;

      hsnMap.set(code, item);
    }

    const items = Array.from(hsnMap.values()).sort((a, b) =>
      a.hsnSacCode.localeCompare(b.hsnSacCode),
    );

    return {
      ...(query.period !== undefined ? { period: query.period } : {}),
      ...(query.startDate !== undefined ? { startDate: query.startDate } : {}),
      ...(query.endDate !== undefined ? { endDate: query.endDate } : {}),
      ...(query.entryType !== undefined ? { entryType: query.entryType } : {}),
      items,
      totalTaxableAmount: Number(totalTaxable.toFixed(2)),
      totalCgstAmount: Number(totalCgst.toFixed(2)),
      totalSgstAmount: Number(totalSgst.toFixed(2)),
      totalIgstAmount: Number(totalIgst.toFixed(2)),
      totalTaxAmount: Number(totalTax.toFixed(2)),
      totalRecords: eligible.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * GSTR-1 Outward Tax Summary Report.
   * Summarizes outward sales supplies, B2B vs B2C, rate slabs, strictly excluding proformas.
   */
  async getGstr1Summary(
    query: QueryGstr1Dto,
  ): Promise<FinanceGstr1SummaryReport> {
    const scope = this.tenantContext.getOrgScope();
    const entries = await this.repository.getPeriodEntries(
      scope,
      query.period,
      "OUTPUT_GST",
    );

    const proformaExcluded = entries.filter((e) => e.isProformaExcluded);
    const eligible = entries.filter(
      (e) => !e.isProformaExcluded && e.status !== "CANCELLED",
    );

    const b2b = {
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
      invoiceCount: 0,
    };

    const b2c = {
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
      invoiceCount: 0,
    };

    const rateMap = new Map<number, Gstr1RateBucket>();

    for (const e of eligible) {
      const taxable = Number(e.taxableAmount);
      const cgst = Number(e.cgstAmount);
      const sgst = Number(e.sgstAmount);
      const igst = Number(e.igstAmount);
      const tax = Number(e.totalTaxAmount);

      // Determine B2B (registered with 15-char GSTIN) vs B2C (unregistered/consumer)
      const isB2b =
        e.gstin &&
        e.gstin.length === 15 &&
        !e.gstin.startsWith("URP") &&
        !e.gstin.startsWith("CONSUMER");

      if (isB2b) {
        b2b.taxableAmount += taxable;
        b2b.cgstAmount += cgst;
        b2b.sgstAmount += sgst;
        b2b.igstAmount += igst;
        b2b.totalTaxAmount += tax;
        b2b.invoiceCount += 1;
      } else {
        b2c.taxableAmount += taxable;
        b2c.cgstAmount += cgst;
        b2c.sgstAmount += sgst;
        b2c.igstAmount += igst;
        b2c.totalTaxAmount += tax;
        b2c.invoiceCount += 1;
      }

      // Determine combined GST rate: (cgstRate + sgstRate) or igstRate
      const cgstR = Number(e.cgstRate);
      const sgstR = Number(e.sgstRate);
      const igstR = Number(e.igstRate);
      const combinedRate = cgstR + sgstR > 0 ? cgstR + sgstR : igstR;

      const bucket = rateMap.get(combinedRate) ?? {
        rate: combinedRate,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTaxAmount: 0,
      };

      bucket.taxableAmount = Number(
        (bucket.taxableAmount + taxable).toFixed(2),
      );
      bucket.cgstAmount = Number((bucket.cgstAmount + cgst).toFixed(2));
      bucket.sgstAmount = Number((bucket.sgstAmount + sgst).toFixed(2));
      bucket.igstAmount = Number((bucket.igstAmount + igst).toFixed(2));
      bucket.totalTaxAmount = Number((bucket.totalTaxAmount + tax).toFixed(2));
      rateMap.set(combinedRate, bucket);
    }

    const totalTaxable = Number(
      (b2b.taxableAmount + b2c.taxableAmount).toFixed(2),
    );
    const totalCgst = Number((b2b.cgstAmount + b2c.cgstAmount).toFixed(2));
    const totalSgst = Number((b2b.sgstAmount + b2c.sgstAmount).toFixed(2));
    const totalIgst = Number((b2b.igstAmount + b2c.igstAmount).toFixed(2));
    const totalTax = Number(
      (b2b.totalTaxAmount + b2c.totalTaxAmount).toFixed(2),
    );

    return {
      period: query.period,
      b2b: {
        taxableAmount: Number(b2b.taxableAmount.toFixed(2)),
        cgstAmount: Number(b2b.cgstAmount.toFixed(2)),
        sgstAmount: Number(b2b.sgstAmount.toFixed(2)),
        igstAmount: Number(b2b.igstAmount.toFixed(2)),
        totalTaxAmount: Number(b2b.totalTaxAmount.toFixed(2)),
        invoiceCount: b2b.invoiceCount,
      },
      b2c: {
        taxableAmount: Number(b2c.taxableAmount.toFixed(2)),
        cgstAmount: Number(b2c.cgstAmount.toFixed(2)),
        sgstAmount: Number(b2c.sgstAmount.toFixed(2)),
        igstAmount: Number(b2c.igstAmount.toFixed(2)),
        totalTaxAmount: Number(b2c.totalTaxAmount.toFixed(2)),
        invoiceCount: b2c.invoiceCount,
      },
      rateBuckets: Array.from(rateMap.values()).sort((a, b) => a.rate - b.rate),
      totalTaxableAmount: totalTaxable,
      totalCgstAmount: totalCgst,
      totalSgstAmount: totalSgst,
      totalIgstAmount: totalIgst,
      totalTaxAmount: totalTax,
      totalInvoices: eligible.length,
      proformaExcludedCount: proformaExcluded.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * GSTR-3B Summary Report.
   * Compares outward tax liability against eligible Input Tax Credit (ITC)
   * and computes Net Tax Payable.
   */
  async getGstr3bSummary(
    query: QueryGstr3bDto,
  ): Promise<FinanceGstr3bSummaryReport> {
    const scope = this.tenantContext.getOrgScope();
    const entries = await this.repository.getPeriodEntries(scope, query.period);

    const outward = {
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
    };

    const itc = {
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
    };

    for (const e of entries) {
      if (e.status === "CANCELLED" || e.isProformaExcluded) {
        continue;
      }

      const taxable = Number(e.taxableAmount);
      const cgst = Number(e.cgstAmount);
      const sgst = Number(e.sgstAmount);
      const igst = Number(e.igstAmount);
      const tax = Number(e.totalTaxAmount);

      if (e.entryType === "OUTPUT_GST") {
        outward.taxableAmount += taxable;
        outward.cgstAmount += cgst;
        outward.sgstAmount += sgst;
        outward.igstAmount += igst;
        outward.totalTaxAmount += tax;
      } else if (e.entryType === "INPUT_TAX_CREDIT") {
        itc.taxableAmount += taxable;
        itc.cgstAmount += cgst;
        itc.sgstAmount += sgst;
        itc.igstAmount += igst;
        itc.totalTaxAmount += tax;
      }
    }

    const netCgst = Math.max(
      0,
      Number((outward.cgstAmount - itc.cgstAmount).toFixed(2)),
    );
    const netSgst = Math.max(
      0,
      Number((outward.sgstAmount - itc.sgstAmount).toFixed(2)),
    );
    const netIgst = Math.max(
      0,
      Number((outward.igstAmount - itc.igstAmount).toFixed(2)),
    );
    const netTotal = Math.max(
      0,
      Number((outward.totalTaxAmount - itc.totalTaxAmount).toFixed(2)),
    );

    return {
      period: query.period,
      outwardTaxableSupplies: {
        taxableAmount: Number(outward.taxableAmount.toFixed(2)),
        cgstAmount: Number(outward.cgstAmount.toFixed(2)),
        sgstAmount: Number(outward.sgstAmount.toFixed(2)),
        igstAmount: Number(outward.igstAmount.toFixed(2)),
        totalTaxAmount: Number(outward.totalTaxAmount.toFixed(2)),
      },
      eligibleItc: {
        taxableAmount: Number(itc.taxableAmount.toFixed(2)),
        cgstAmount: Number(itc.cgstAmount.toFixed(2)),
        sgstAmount: Number(itc.sgstAmount.toFixed(2)),
        igstAmount: Number(itc.igstAmount.toFixed(2)),
        totalTaxAmount: Number(itc.totalTaxAmount.toFixed(2)),
      },
      netTaxPayable: {
        cgstAmount: netCgst,
        sgstAmount: netSgst,
        igstAmount: netIgst,
        totalTaxAmount: netTotal,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * GST Input Tax Credit (ITC) Reconciliation Engine.
   * Compares ERP purchase books against counterpart GSTR-2B filing data.
   */
  async reconcile(
    dto: ReconcileGstDto,
  ): Promise<FinanceGstReconciliationResult> {
    const scope = this.tenantContext.getOrgScope();
    const booksEntries = await this.repository.getPeriodEntries(
      scope,
      dto.period,
      "INPUT_TAX_CREDIT",
    );

    const activeBooks = booksEntries.filter((e) => e.status !== "CANCELLED");

    // Index ERP books by normalized invoice key: UPPERCASE(REF)_GSTIN
    const booksMap = new Map<string, (typeof activeBooks)[0]>();
    for (const b of activeBooks) {
      const key = `${b.sourceReference.trim().toUpperCase()}_${b.gstin.trim().toUpperCase()}`;
      booksMap.set(key, b);
    }

    const matchedIds: number[] = [];
    const discrepancies: GstReconciliationDiscrepancyItem[] = [];

    const matchedPortalKeys = new Set<string>();
    let matchedCount = 0;
    let taxMismatchCount = 0;
    let totalPortalItc = 0;
    let totalBooksItc = 0;
    let eligibleItc = 0;

    for (const b of activeBooks) {
      totalBooksItc += Number(b.totalTaxAmount);
    }

    // Evaluate each counterpart record
    for (const cp of dto.counterpartEntries) {
      const key = `${cp.invoiceNumber.trim().toUpperCase()}_${cp.gstin.trim().toUpperCase()}`;
      matchedPortalKeys.add(key);

      const portalTax = Number(cp.totalTaxAmount);
      totalPortalItc += portalTax;

      const book = booksMap.get(key);

      if (book) {
        const bookTax = Number(book.totalTaxAmount);
        const diff = Math.abs(bookTax - portalTax);

        if (diff <= 1.0) {
          // Matched within 1.00 INR rounding tolerance
          matchedCount += 1;
          matchedIds.push(book.id);
          eligibleItc += Math.min(bookTax, portalTax);
        } else {
          // Tax mismatch
          taxMismatchCount += 1;
          eligibleItc += Math.min(bookTax, portalTax);
          discrepancies.push({
            status: "TAX_MISMATCH",
            invoiceReference: cp.invoiceNumber,
            gstin: cp.gstin,
            booksTaxableAmount: Number(book.taxableAmount),
            booksTaxAmount: bookTax,
            portalTaxableAmount: cp.taxableAmount,
            portalTaxAmount: portalTax,
            taxDifference: Number((bookTax - portalTax).toFixed(2)),
            notes: `Tax difference of ${diff.toFixed(2)} exceeds 1.00 INR tolerance threshold.`,
          });
        }
      } else {
        // Missing in Books (unclaimed ITC on portal)
        discrepancies.push({
          status: "MISSING_IN_BOOKS",
          invoiceReference: cp.invoiceNumber,
          gstin: cp.gstin,
          booksTaxableAmount: null,
          booksTaxAmount: null,
          portalTaxableAmount: cp.taxableAmount,
          portalTaxAmount: portalTax,
          taxDifference: Number((-portalTax).toFixed(2)),
          notes:
            "Invoice present in vendor GSTR-2B filing but missing in ERP purchase books.",
        });
      }
    }

    // Identify books entries missing in portal
    let missingInPortalCount = 0;
    for (const b of activeBooks) {
      const key = `${b.sourceReference.trim().toUpperCase()}_${b.gstin.trim().toUpperCase()}`;
      if (!matchedPortalKeys.has(key)) {
        missingInPortalCount += 1;
        discrepancies.push({
          status: "MISSING_IN_PORTAL",
          invoiceReference: b.sourceReference,
          gstin: b.gstin,
          booksTaxableAmount: Number(b.taxableAmount),
          booksTaxAmount: Number(b.totalTaxAmount),
          portalTaxableAmount: null,
          portalTaxAmount: null,
          taxDifference: Number(Number(b.totalTaxAmount).toFixed(2)),
          notes:
            "Invoice recorded in ERP purchase books but not reflected in vendor GSTR-2B filing.",
        });
      }
    }

    const missingInBooksCount = discrepancies.filter(
      (d) => d.status === "MISSING_IN_BOOKS",
    ).length;

    let reconciledEntriesUpdated = 0;
    if (dto.persistReconciliation && matchedIds.length > 0) {
      reconciledEntriesUpdated = await this.repository.markReconciled(
        scope,
        matchedIds,
      );
    }

    return {
      period: dto.period,
      totalBooksRecords: activeBooks.length,
      totalPortalRecords: dto.counterpartEntries.length,
      matchedCount,
      taxMismatchCount,
      missingInPortalCount,
      missingInBooksCount,
      totalBooksItc: Number(totalBooksItc.toFixed(2)),
      totalPortalItc: Number(totalPortalItc.toFixed(2)),
      eligibleItc: Number(eligibleItc.toFixed(2)),
      discrepancies,
      reconciledEntriesUpdated,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves summary counts of reconciled vs active ITC entries for a period.
   */
  async getReconciliationSummary(period: string) {
    const scope = this.tenantContext.getOrgScope();
    const entries = await this.repository.getPeriodEntries(
      scope,
      period,
      "INPUT_TAX_CREDIT",
    );

    const active = entries.filter((e) => e.status !== "CANCELLED");
    const reconciled = active.filter((e) => e.status === "RECONCILED");
    const pending = active.filter((e) => e.status === "ACTIVE");

    let totalItc = 0;
    let reconciledItc = 0;

    for (const e of active) {
      const tax = Number(e.totalTaxAmount);
      totalItc += tax;
      if (e.status === "RECONCILED") {
        reconciledItc += tax;
      }
    }

    return {
      period,
      totalEntries: active.length,
      reconciledCount: reconciled.length,
      pendingCount: pending.length,
      totalItcAmount: Number(totalItc.toFixed(2)),
      reconciledItcAmount: Number(reconciledItc.toFixed(2)),
      reconciliationPercentage:
        active.length > 0
          ? Number(((reconciled.length / active.length) * 100).toFixed(1))
          : 100,
      generatedAt: new Date().toISOString(),
    };
  }
}
