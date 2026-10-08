import { describe, expect, it } from "vitest";
import {
  esc,
  money,
  type PayslipPdfView,
  periodLabel,
  renderPayslipHtml,
} from "./payslip-pdf.template.js";

function view(overrides: Partial<PayslipPdfView["employee"]> = {}) {
  return {
    payslipNumber: "PS-202605-0001",
    netPayable: "52200.00",
    generatedAt: "2026-06-01T00:00:00.000Z",
    employee: {
      employeeCode: "EMP001",
      fullName: "Asha Rao",
      designation: { name: "Engineer" },
      department: { name: "Software" },
      pfProfile: { uan: "100200300400", pfNumber: null },
      esiProfile: null,
      bankDetails: {
        bankName: "State Bank",
        accountNumber: "********1234",
        ifscCode: "SBIN0000001",
        panNumber: "******234F",
      },
      ...overrides,
    },
    payrollPeriod: { year: 2026, month: 5 },
    payrollEntry: {
      totalCalendarDays: 31,
      payableDays: "31.00",
      lopDays: "0.00",
      totalGrossEarnings: "55000.00",
      totalDeductions: "2800.00",
      earnings: [
        { name: "Basic", calculatedAmount: "30000.00" },
        { name: "HRA", calculatedAmount: "25000.00" },
      ],
      deductions: [{ name: "PF", amount: "2800.00" }],
    },
  } satisfies PayslipPdfView;
}

describe("payslip PDF template", () => {
  it("escapes HTML-significant characters", () => {
    expect(esc(`<b a="1">&'`)).toBe("&lt;b a=&quot;1&quot;&gt;&amp;&#39;");
    expect(esc(null)).toBe("");
  });

  it("formats amounts with two decimals and Indian grouping", () => {
    expect(money("123456.5")).toBe("1,23,456.50");
    expect(money(null)).toBe("0.00");
    expect(money("not a number")).toBe("0.00");
  });

  it("labels the period by month name", () => {
    expect(periodLabel({ year: 2026, month: 5 })).toBe("May 2026");
  });

  it("renders employee, line items, totals and net pay", () => {
    const html = renderPayslipHtml(view());

    expect(html).toContain("Payslip — May 2026");
    expect(html).toContain("PS-202605-0001");
    expect(html).toContain("Asha Rao (EMP001)");
    expect(html).toContain("State Bank · ********1234 · SBIN0000001");
    expect(html).toContain("Basic");
    expect(html).toContain("30,000.00");
    expect(html).toContain("PF");
    expect(html).toContain("55,000.00");
    expect(html).toContain("Net payable: ₹ 52,200.00");
  });

  it("never emits user-entered markup unescaped", () => {
    const html = renderPayslipHtml(
      view({ fullName: "<script>alert(1)</script>" }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("shows a dash when bank details are missing", () => {
    const html = renderPayslipHtml(view({ bankDetails: null }));
    expect(html).toContain("<tr><th>Bank</th><td>—</td></tr>");
  });
});
