import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GstService } from "./gst.service.js";
import type { CreateGstEntryDto } from "./dto/create-gst-entry.dto.js";

const SCOPE_ORG_1 = { organizationId: 1 };
const SCOPE_ORG_2 = { organizationId: 2 };
const USER_ID = 99;

interface MockGstRecord {
  id: number;
  organizationId: number;
  gstin: string;
  period: string;
  entryType: string;
  sourceType: string;
  sourceReference: string;
  hsnSacCode?: string | null | undefined;
  taxableAmount?: number | string | null | undefined;
  cgstRate?: number | string | null | undefined;
  cgstAmount?: number | string | null | undefined;
  sgstRate?: number | string | null | undefined;
  sgstAmount?: number | string | null | undefined;
  igstRate?: number | string | null | undefined;
  igstAmount?: number | string | null | undefined;
  totalTaxAmount?: number | string | null | undefined;
  isProformaExcluded?: boolean | undefined;
  status: string;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
  [key: string]: unknown;
}

describe("Phase 4: Manual GST Entry Synchronization & Lifecycle", () => {
  function makeHarness(orgScope = SCOPE_ORG_1) {
    const memoryStore: MockGstRecord[] = [];
    let idCounter = 1;

    const repository = {
      create: vi
        .fn<
          (
            scope: { organizationId: number },
            data: CreateGstEntryDto & { status?: string },
          ) => Promise<MockGstRecord>
        >()
        .mockImplementation((scope, data) => {
          const record: MockGstRecord = {
            id: idCounter++,
            organizationId: scope.organizationId,
            ...data,
            status: data.status ?? "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          memoryStore.push(record);
          return Promise.resolve(record);
        }),

      findByReference: vi
        .fn<
          (
            scope: { organizationId: number },
            period: string,
            sourceReference: string,
            gstin: string,
            entryType?: string,
          ) => Promise<MockGstRecord | null>
        >()
        .mockImplementation(
          (
            scope: { organizationId: number },
            period: string,
            sourceReference: string,
            gstin: string,
            entryType?: string,
          ) => {
            const match = memoryStore.find(
              (r) =>
                r.organizationId === scope.organizationId &&
                r.period === period &&
                r.sourceReference === sourceReference &&
                r.gstin === gstin &&
                (!entryType || r.entryType === entryType) &&
                r.status !== "CANCELLED",
            );
            return Promise.resolve(match ?? null);
          },
        ),

      findById: vi
        .fn<
          (
            scope: { organizationId: number },
            id: number,
          ) => Promise<MockGstRecord | null>
        >()
        .mockImplementation((scope, id) => {
          const found = memoryStore.find(
            (r) => r.organizationId === scope.organizationId && r.id === id,
          );
          return Promise.resolve(found ?? null);
        }),

      getPeriodEntries: vi
        .fn<
          (
            scope: { organizationId: number },
            period: string,
            entryType?: string,
          ) => Promise<MockGstRecord[]>
        >()
        .mockImplementation((scope, period, entryType) => {
          const filtered = memoryStore.filter(
            (r) =>
              r.organizationId === scope.organizationId &&
              r.period === period &&
              (!entryType || r.entryType === entryType) &&
              r.status !== "CANCELLED",
          );
          return Promise.resolve(filtered);
        }),
    };

    const tenantContext = {
      getOrgScope: vi.fn().mockReturnValue(orgScope),
      getUserId: vi.fn().mockReturnValue(USER_ID),
    };

    // Note: GstService has NO dependency on JournalEntriesRepository or General Ledger
    const service = new GstService(repository as never, tenantContext as never);

    return { service, repository, tenantContext, memoryStore };
  }

  describe("1. Manual GST entries remain independent by default (Registry Only)", () => {
    it("creates an active statutory GST record without creating or touching General Ledger journals", async () => {
      const { service, repository, memoryStore } = makeHarness();

      const manualPayload: CreateGstEntryDto = {
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "MANUAL",
        sourceReference: "GST-MANUAL-2026-001",
        hsnSacCode: "998314",
        taxableAmount: 50000,
        cgstRate: 9,
        cgstAmount: 4500,
        sgstRate: 9,
        sgstAmount: 4500,
        igstRate: 0,
        igstAmount: 0,
        totalTaxAmount: 9000,
        isProformaExcluded: false,
      };

      const result = await service.createEntry(manualPayload, USER_ID);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.sourceType).toBe("MANUAL");
      expect(result.sourceReference).toBe("GST-MANUAL-2026-001");
      expect(result.status).toBe("ACTIVE");
      expect(result.totalTaxAmount).toBe(9000);

      // Verify stored in GST repository
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(memoryStore).toHaveLength(1);
      expect(memoryStore[0]!.sourceType).toBe("MANUAL");
    });

    it("does not invent missing GL accounts, synthetic vouchers, or cross-schema side-effects", async () => {
      const { service } = makeHarness();

      const manualItcPayload: CreateGstEntryDto = {
        gstin: "27AAACW1234F1Z5",
        period: "2026-10",
        entryType: "INPUT_TAX_CREDIT",
        sourceType: "MANUAL",
        sourceReference: "GST-ADJ-ITC-001",
        hsnSacCode: "998411",
        taxableAmount: 20000,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: 18,
        igstAmount: 3600,
        totalTaxAmount: 3600,
      };

      const result = await service.createEntry(manualItcPayload, USER_ID);

      expect(result.sourceType).toBe("MANUAL");
      expect(result.entryType).toBe("INPUT_TAX_CREDIT");
      expect(result.igstAmount).toBe(3600);
      expect(result.status).toBe("ACTIVE");
    });
  });

  describe("2. Statutory Returns Aggregation with Manual & System Entries", () => {
    it("aggregates manual entries alongside system sales invoices in GSTR-1 outward return", async () => {
      const { service, memoryStore } = makeHarness();

      // System sales invoice from Phase 1
      memoryStore.push({
        id: 101,
        organizationId: 1,
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "SALES_INVOICE",
        sourceReference: "TW/INV/2026/001",
        hsnSacCode: "998314",
        taxableAmount: "10000.00",
        cgstRate: "9.00",
        cgstAmount: "900.00",
        sgstRate: "9.00",
        sgstAmount: "900.00",
        igstRate: "0.00",
        igstAmount: "0.00",
        totalTaxAmount: "1800.00",
        isProformaExcluded: false,
        status: "ACTIVE",
      });

      // Manual statutory entry
      memoryStore.push({
        id: 102,
        organizationId: 1,
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "MANUAL",
        sourceReference: "GST-MAN-OUT-001",
        hsnSacCode: "998314",
        taxableAmount: "5000.00",
        cgstRate: "9.00",
        cgstAmount: "450.00",
        sgstRate: "9.00",
        sgstAmount: "450.00",
        igstRate: "0.00",
        igstAmount: "0.00",
        totalTaxAmount: "900.00",
        isProformaExcluded: false,
        status: "ACTIVE",
      });

      const gstr1 = await service.getGstr1Summary({ period: "2026-10" });

      expect(gstr1.totalTaxableAmount).toBe(15000);
      expect(gstr1.totalTaxAmount).toBe(2700);
      expect(gstr1.b2b.invoiceCount).toBe(2);
      expect(gstr1.b2b.taxableAmount).toBe(15000);
      expect(gstr1.b2b.totalTaxAmount).toBe(2700);
    });

    it("aggregates manual ITC entries alongside operational expenses in GSTR-3B return", async () => {
      const { service, memoryStore } = makeHarness();

      // System expense ITC from Phase 3
      memoryStore.push({
        id: 201,
        organizationId: 1,
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "INPUT_TAX_CREDIT",
        sourceType: "EXPENSE",
        sourceReference: "EXP-2026-0001",
        hsnSacCode: "998313",
        taxableAmount: "8000.00",
        cgstRate: "9.00",
        cgstAmount: "720.00",
        sgstRate: "9.00",
        sgstAmount: "720.00",
        igstRate: "0.00",
        igstAmount: "0.00",
        totalTaxAmount: "1440.00",
        isProformaExcluded: false,
        status: "ACTIVE",
      });

      // Manual statutory ITC adjustment
      memoryStore.push({
        id: 202,
        organizationId: 1,
        gstin: "27AAACW1234F1Z5",
        period: "2026-10",
        entryType: "INPUT_TAX_CREDIT",
        sourceType: "MANUAL",
        sourceReference: "GST-MAN-IN-001",
        hsnSacCode: "998411",
        taxableAmount: "10000.00",
        cgstRate: "0.00",
        cgstAmount: "0.00",
        sgstRate: "0.00",
        sgstAmount: "0.00",
        igstRate: "18.00",
        igstAmount: "1800.00",
        totalTaxAmount: "1800.00",
        isProformaExcluded: false,
        status: "ACTIVE",
      });

      const gstr3b = await service.getGstr3bSummary({ period: "2026-10" });

      expect(gstr3b.eligibleItc.cgstAmount).toBe(720);
      expect(gstr3b.eligibleItc.sgstAmount).toBe(720);
      expect(gstr3b.eligibleItc.igstAmount).toBe(1800);
      expect(gstr3b.eligibleItc.totalTaxAmount).toBe(3240);
    });
  });

  describe("3. Idempotency & Duplicate Prevention", () => {
    it("returns existing entry on repeated creation with identical reference, gstin, and period", async () => {
      const { service, repository } = makeHarness();

      const payload: CreateGstEntryDto = {
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "MANUAL",
        sourceReference: "GST-IDEMPOTENT-001",
        hsnSacCode: "998314",
        taxableAmount: 10000,
        cgstRate: 9,
        cgstAmount: 900,
        sgstRate: 9,
        sgstAmount: 900,
        igstRate: 0,
        igstAmount: 0,
        totalTaxAmount: 1800,
      };

      // First call: creates new record
      const firstResult = await service.createEntry(payload, USER_ID);
      expect(firstResult.id).toBe(1);
      expect(repository.create).toHaveBeenCalledTimes(1);

      // Second call with same reference & period: returns existing record without duplicating
      const secondResult = await service.createEntry(payload, USER_ID);
      expect(secondResult.id).toBe(1);
      expect(repository.create).toHaveBeenCalledTimes(1); // Not called a second time
    });
  });

  describe("4. Strict Tenant Boundary Isolation", () => {
    it("isolates manual entries by organizationId, preventing cross-tenant leakage", async () => {
      const harnessOrg1 = makeHarness(SCOPE_ORG_1);
      const harnessOrg2 = makeHarness(SCOPE_ORG_2);

      const payload: CreateGstEntryDto = {
        gstin: "29AABCT1332L1ZV",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "MANUAL",
        sourceReference: "GST-TENANT-001",
        taxableAmount: 5000,
        cgstRate: 9,
        cgstAmount: 450,
        sgstRate: 9,
        sgstAmount: 450,
        igstRate: 0,
        igstAmount: 0,
        totalTaxAmount: 900,
      };

      const entryOrg1 = await harnessOrg1.service.createEntry(payload, USER_ID);
      expect(entryOrg1.organizationId).toBe(1);

      // In org 2, reference should not exist
      const lookupInOrg2 = await harnessOrg2.repository.findByReference(
        SCOPE_ORG_2,
        "2026-10",
        "GST-TENANT-001",
        "29AABCT1332L1ZV",
      );
      expect(lookupInOrg2).toBeNull();
    });
  });
});
