import { describe, expect, it } from "vitest";
import { type PayslipSnapshot, sameSnapshot } from "./payslip-snapshot.js";

const snap = { netPayable: "100", company: { name: "X", gstin: null } };

describe("sameSnapshot", () => {
  it("ignores key order (PostgreSQL jsonb reorders keys)", () => {
    const fromDb = { company: { gstin: null, name: "X" }, netPayable: "100" };
    expect(sameSnapshot(fromDb, snap as unknown as PayslipSnapshot)).toBe(true);
  });

  it("sees a changed value", () => {
    const fromDb = { company: { gstin: null, name: "Y" }, netPayable: "100" };
    expect(sameSnapshot(fromDb, snap as unknown as PayslipSnapshot)).toBe(
      false,
    );
  });
});
