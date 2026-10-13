import { describe, expect, it } from "vitest";
import { assertSlabsContiguous } from "../tax/tax-setup.service.js";
import { csv, ecrText, salaryJournal } from "./payroll-reports.rules.js";

describe("payroll files", () => {
  it("writes ECR lines with #~# separators in whole rupees", () => {
    expect(
      ecrText([
        {
          uan: "100200300400",
          name: "Asha #~# Rao",
          grossWage: 30000.4,
          pfWage: 15000,
          epsWage: 15000,
          edliWage: 15000,
          employeeContribution: 1800,
          epsContribution: 1249.5,
          epfEmployerContribution: 550.5,
          ncpDays: 2,
        },
      ]),
    ).toBe(
      "100200300400#~#ASHA   RAO#~#30000#~#15000#~#15000#~#15000#~#1800#~#1250#~#551#~#2#~#0",
    );
  });

  it("writes CSV with a BOM and neutralises formulas", () => {
    const out = csv(["Name", "Amount"], [["=SUM(A1)", 10]]);
    expect(out.charCodeAt(0) === 0xfeff).toBe(true);
    expect(out).toContain(`"'=SUM(A1)","10"`);
  });

  it("produces a balanced salary journal", () => {
    const lines = salaryJournal({
      earnings: [
        { code: "BASIC", name: "Basic", amount: 30000 },
        { code: "HRA", name: "HRA", amount: 20000 },
      ],
      deductions: [
        { code: "PF", name: "PF", amount: 1800 },
        { code: "TDS", name: "TDS", amount: 1000 },
      ],
      employerPf: 1800,
      employerEdli: 75,
      pfAdmin: 75,
      employerEsi: 0,
      netPayable: 47200,
    });
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    expect(debit).toBe(credit);
    expect(lines.find((l) => l.account === "PF payable")?.credit).toBe(3750);
  });
});

describe("tax slabs", () => {
  it("accepts contiguous slabs from 0 with an open last slab", () => {
    expect(() =>
      assertSlabsContiguous([
        { fromIncome: 0, toIncome: 400000, ratePercent: 0 },
        { fromIncome: 400000, toIncome: null, ratePercent: 5 },
      ]),
    ).not.toThrow();
  });

  it.each([
    [[{ fromIncome: 100, toIncome: null, ratePercent: 0 }]],
    [
      [
        { fromIncome: 0, toIncome: 400000, ratePercent: 0 },
        { fromIncome: 500000, toIncome: null, ratePercent: 5 },
      ],
    ],
    [
      [
        { fromIncome: 0, toIncome: null, ratePercent: 0 },
        { fromIncome: 400000, toIncome: null, ratePercent: 5 },
      ],
    ],
  ])("rejects gaps, a non-zero start or an open middle slab", (slabs) => {
    expect(() => assertSlabsContiguous(slabs)).toThrow();
  });
});
