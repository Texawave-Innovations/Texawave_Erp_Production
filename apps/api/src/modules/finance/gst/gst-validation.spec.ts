import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateGstEntryDto } from "./dto/create-gst-entry.dto.js";
import { QueryGstEntriesDto } from "./dto/query-gst-entries.dto.js";
import { QueryGstr1Dto } from "./dto/query-gstr1.dto.js";
import { QueryGstr3bDto } from "./dto/query-gstr3b.dto.js";
import { QueryHsnSummaryDto } from "./dto/query-hsn-summary.dto.js";
import {
  CounterpartGstEntryDto,
  ReconcileGstDto,
} from "./dto/reconcile-gst.dto.js";
import { GstService } from "./gst.service.js";
import type { GstRepository } from "./gst.repository.js";
import type { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";

const validateDto = <T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
) => {
  return validateSync(plainToInstance(cls, body));
};

describe("GST DTO, Business Rule & Reconciliation Validation", () => {
  describe("CreateGstEntryDto", () => {
    const validEntry = {
      gstin: "29AABCT1332L1ZV",
      period: "2026-10",
      entryType: "OUTPUT_GST",
      sourceType: "SALES_INVOICE",
      sourceReference: "TEXA/INV/2026/001",
      hsnSacCode: "998314",
      taxableAmount: 10000.0,
      cgstRate: 9.0,
      cgstAmount: 900.0,
      sgstRate: 9.0,
      sgstAmount: 900.0,
      igstRate: 0.0,
      igstAmount: 0.0,
      totalTaxAmount: 1800.0,
      isProformaExcluded: false,
    };

    it("accepts a valid GST tax ledger entry payload", () => {
      const errors = validateDto(CreateGstEntryDto, validEntry);
      expect(errors).toHaveLength(0);
    });

    it("rejects invalid GSTIN formats", () => {
      // Too short
      let errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        gstin: "29AABCT1332",
      });
      expect(errors.some((e) => e.property === "gstin")).toBe(true);

      // Lowercase characters
      errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        gstin: "29aabct1332l1zv",
      });
      expect(errors.some((e) => e.property === "gstin")).toBe(true);

      // Invalid character structure
      errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        gstin: "INVALID_GSTIN_123",
      });
      expect(errors.some((e) => e.property === "gstin")).toBe(true);
    });

    it("rejects invalid filing periods", () => {
      // Month out of range (month 13)
      let errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        period: "2026-13",
      });
      expect(errors.some((e) => e.property === "period")).toBe(true);

      // Month 00
      errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        period: "2026-00",
      });
      expect(errors.some((e) => e.property === "period")).toBe(true);

      // Slash separator instead of hyphen
      errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        period: "2026/10",
      });
      expect(errors.some((e) => e.property === "period")).toBe(true);
    });

    it("rejects zero or negative taxable base amount", () => {
      let errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        taxableAmount: 0,
      });
      expect(errors.some((e) => e.property === "taxableAmount")).toBe(true);

      errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        taxableAmount: -500,
      });
      expect(errors.some((e) => e.property === "taxableAmount")).toBe(true);
    });

    it("rejects negative tax component amounts", () => {
      const errors = validateDto(CreateGstEntryDto, {
        ...validEntry,
        cgstAmount: -10,
      });
      expect(errors.some((e) => e.property === "cgstAmount")).toBe(true);
    });

    it("rejects missing required fields", () => {
      const errors = validateDto(CreateGstEntryDto, {});
      const props = errors.map((e) => e.property);
      expect(props).toContain("gstin");
      expect(props).toContain("period");
      expect(props).toContain("entryType");
      expect(props).toContain("sourceType");
      expect(props).toContain("sourceReference");
      expect(props).toContain("taxableAmount");
    });
  });

  describe("ReconcileGstDto and CounterpartGstEntryDto", () => {
    const validCounterpart = {
      gstin: "29AABCT1332L1ZV",
      invoiceNumber: "BILL-2026-001",
      invoiceDate: "2026-10-15",
      taxableAmount: 50000,
      cgstAmount: 4500,
      sgstAmount: 4500,
      igstAmount: 0,
      totalTaxAmount: 9000,
    };

    it("accepts valid reconciliation payload", () => {
      const errors = validateDto(ReconcileGstDto, {
        period: "2026-10",
        persistReconciliation: true,
        counterpartEntries: [validCounterpart],
      });
      expect(errors).toHaveLength(0);
    });

    it("rejects invalid period in reconciliation", () => {
      const errors = validateDto(ReconcileGstDto, {
        period: "2026/10",
        counterpartEntries: [validCounterpart],
      });
      expect(errors.some((e) => e.property === "period")).toBe(true);
    });

    it("rejects negative total tax amount in counterpart entry", () => {
      const errors = validateDto(CounterpartGstEntryDto, {
        ...validCounterpart,
        totalTaxAmount: -100,
      });
      expect(errors.some((e) => e.property === "totalTaxAmount")).toBe(true);
    });
  });

  describe("Query DTOs", () => {
    it("validates QueryGstr1Dto period regex", () => {
      const valid = validateDto(QueryGstr1Dto, { period: "2026-10" });
      expect(valid).toHaveLength(0);

      const invalid = validateDto(QueryGstr1Dto, { period: "INVALID" });
      expect(invalid).toHaveLength(1);
    });

    it("validates QueryGstr3bDto period regex", () => {
      const valid = validateDto(QueryGstr3bDto, { period: "2026-10" });
      expect(valid).toHaveLength(0);

      const invalid = validateDto(QueryGstr3bDto, { period: "2026-9" });
      expect(invalid).toHaveLength(1);
    });

    it("validates QueryHsnSummaryDto entryType enum", () => {
      const valid = validateDto(QueryHsnSummaryDto, {
        period: "2026-10",
        entryType: "OUTPUT_GST",
      });
      expect(valid).toHaveLength(0);

      const invalid = validateDto(QueryHsnSummaryDto, {
        entryType: "INVALID_ENUM",
      });
      expect(invalid).toHaveLength(1);
    });

    it("validates QueryGstEntriesDto status enum", () => {
      const valid = validateDto(QueryGstEntriesDto, {
        status: "RECONCILED",
      });
      expect(valid).toHaveLength(0);

      const invalid = validateDto(QueryGstEntriesDto, {
        status: "NONEXISTENT",
      });
      expect(invalid).toHaveLength(1);
    });
  });

  describe("GstService Business Rules & Proforma Auto-Detection", () => {
    const mockRepo = {
      create: vi
        .fn()
        .mockImplementation((_scope, data) =>
          Promise.resolve({ id: 1, ...data }),
        ),
      getPeriodEntries: vi.fn().mockResolvedValue([]),
    };
    const mockTenant = {
      getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    };

    const service = new GstService(
      mockRepo as unknown as GstRepository,
      mockTenant as unknown as TenantContextService,
    );

    it("auto-detects proforma exclusion when reference contains 'PI-'", async () => {
      await service.createEntry({
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "SALES_INVOICE",
        sourceReference: "PI-2026-0042",
        taxableAmount: 1000,
        cgstAmount: 90,
        sgstAmount: 90,
        igstAmount: 0,
        totalTaxAmount: 180,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isProformaExcluded: true,
        }),
      );
    });

    it("auto-detects proforma exclusion when reference contains '/PI/'", async () => {
      await service.createEntry({
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "SALES_INVOICE",
        sourceReference: "EST/PI/2026/09",
        taxableAmount: 1000,
        cgstAmount: 90,
        sgstAmount: 90,
        igstAmount: 0,
        totalTaxAmount: 180,
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isProformaExcluded: true,
        }),
      );
    });

    it("throws BusinessRuleViolationException when tax component sum does not match totalTaxAmount", async () => {
      await expect(
        service.createEntry({
          gstin: "29AABCT1332L1ZV",
          period: "2026-10",
          entryType: "OUTPUT_GST",
          sourceType: "SALES_INVOICE",
          sourceReference: "INV-2026-001",
          taxableAmount: 1000,
          cgstAmount: 90,
          sgstAmount: 90,
          igstAmount: 0,
          totalTaxAmount: 500, // Deliberate component mismatch
        }),
      ).rejects.toThrow("Sum of CGST");
    });
  });
});
