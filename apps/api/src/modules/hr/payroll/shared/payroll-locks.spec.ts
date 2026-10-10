import { describe, expect, it, vi } from "vitest";
import {
  issuePayrollNumber,
  lockPayrollPeriod,
  periodTag,
} from "./payroll-locks.js";

/** Values interpolated into a tagged-template raw query (strings[] excluded). */
function sqlValues(call: unknown[]): unknown[] {
  return call.slice(1);
}

function sqlText(call: unknown[]): string {
  return (call[0] as TemplateStringsArray).join("?");
}

describe("lockPayrollPeriod", () => {
  it("returns the locked row, filtered by period id and organization", async () => {
    const period = {
      id: 7,
      year: 2026,
      month: 4,
      status: "DRAFT",
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-04-30"),
    };
    const tx = { $queryRaw: vi.fn().mockResolvedValue([period]) };

    const result = await lockPayrollPeriod(tx as never, 1, 7);

    expect(result).toBe(period);
    const call = tx.$queryRaw.mock.calls[0]!;
    expect(sqlText(call)).toContain("FOR UPDATE");
    expect(sqlText(call)).toContain("deleted_at IS NULL");
    expect(sqlValues(call)).toEqual([7, 1]);
  });

  it("returns null when no row matches (missing or other organization)", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(lockPayrollPeriod(tx as never, 1, 99)).resolves.toBeNull();
  });
});

describe("issuePayrollNumber", () => {
  it.each([
    ["payslip", "PS-"],
    ["payment_batch", "BATCH-"],
    ["employee_loan", "LOAN-"],
  ] as const)(
    "seeds the %s sequence with prefix %s and returns the issued number",
    async (docType, prefix) => {
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(0),
        $queryRaw: vi.fn().mockResolvedValue([{ issued: 12n }]),
      };

      const issued = await issuePayrollNumber(tx as never, 5, docType);

      expect(issued).toBe(12);
      const insert = tx.$executeRaw.mock.calls[0]!;
      expect(sqlText(insert)).toContain("ON CONFLICT");
      expect(sqlValues(insert)).toEqual([5, docType, prefix]);
      const update = tx.$queryRaw.mock.calls[0]!;
      expect(sqlText(update)).toContain("next_number = next_number + 1");
      expect(sqlValues(update)).toEqual([5, docType]);
      // the counter row is seeded before it is incremented
      expect(tx.$executeRaw.mock.invocationCallOrder[0]!).toBeLessThan(
        tx.$queryRaw.mock.invocationCallOrder[0]!,
      );
    },
  );

  it("throws when the sequence row is missing (e.g. soft-deleted)", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    await expect(issuePayrollNumber(tx as never, 5, "payslip")).rejects.toThrow(
      "No active payslip sequence for organization 5",
    );
  });
});

describe("periodTag", () => {
  it("formats year and zero-padded month", () => {
    expect(periodTag({ year: 2026, month: 4 })).toBe("202604");
    expect(periodTag({ year: 2026, month: 12 })).toBe("202612");
  });
});
