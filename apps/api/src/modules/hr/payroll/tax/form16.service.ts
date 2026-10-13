import { Injectable } from "@nestjs/common";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { HtmlPdfRenderer } from "../../../../shared/pdf/html-pdf-renderer.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { EmployeeQueryService } from "../../employees/employee-query.service.js";
import type { Prisma } from "@texawave-erp/database";
import { acceptedAmounts } from "../runs/payroll-calculator.service.js";
import { round2 } from "../runs/payroll-engine.rules.js";
import { toRules } from "../settings/payroll-settings.rules.js";
import { maskTail } from "../shared/sensitive-data.js";
import { esc, money, periodLabel } from "../payslips/payslip-pdf.template.js";
import { allowedDeductions, annualTax } from "./tds.rules.js";
import { assertFinancialYear } from "./tax-declarations.service.js";

/** Form 16 has its own renderer token, so tests can replace it. */
@Injectable()
export class Form16PdfRenderer extends HtmlPdfRenderer {}

export interface Form16 {
  financialYear: string;
  employer: {
    name: string | null;
    address: string | null;
    pan: string | null;
    tan: string | null;
  };
  employee: {
    employeeCode: string;
    fullName: string;
    pan: string | null;
  };
  regime: "OLD" | "NEW";
  months: Array<{
    year: number;
    month: number;
    grossEarnings: number;
    taxableEarnings: number;
    tds: number;
  }>;
  totals: {
    grossEarnings: number;
    taxableSalary: number;
    otherIncome: number;
    previousEmployerIncome: number;
    deductions: number;
    taxableIncome: number;
    taxPayable: number | null;
    tdsDeducted: number;
    previousEmployerTds: number;
  };
}

/**
 * Form 16 Part B (salary and tax computation) for a financial year, built
 * only from FINALIZED payroll (Docs/PAYROLL_AND_COMPLIANCE.md §4.14). Part A
 * (the TDS certificate with challan details) comes from the TRACES portal
 * and is not produced here. PAN is shown masked, as on payslips.
 */
@Injectable()
export class Form16Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employeeQuery: EmployeeQueryService,
    private readonly renderer: Form16PdfRenderer,
  ) {}

  async forHr(employeeId: number, financialYear: string): Promise<Form16> {
    const scope = await this.teamContext.resolveScope(
      "hr.tax_declaration.read",
    );
    return this.build(scope, employeeId, financialYear);
  }

  async forSelf(financialYear: string): Promise<Form16> {
    const employee = await this.employeeQuery.getCurrentEmployee();
    const { organizationId } = this.tenantContext.getOrgScope();
    return this.build(
      { level: "all", userId: 0, organizationId, teamIds: [] },
      employee.id,
      financialYear,
    );
  }

  async pdf(form: Form16): Promise<{ buffer: Buffer; fileName: string }> {
    return {
      buffer: await this.renderer.render(renderForm16Html(form)),
      fileName: `Form16-${form.employee.employeeCode}-${form.financialYear}.pdf`,
    };
  }

  /** `scope` filters the employee (HR: their read scope; self: their own
   * employee id only, passed by `forSelf`). */
  private async build(
    scope: TeamScope,
    employeeId: number,
    financialYear: string,
  ): Promise<Form16> {
    assertFinancialYear(financialYear);
    const { organizationId } = scope;
    const employee = await this.prisma.employee.findFirst({
      where: teamWhere(scope, {
        id: employeeId,
        deletedAt: null,
      }) as Prisma.EmployeeWhereInput,
      select: {
        employeeCode: true,
        fullName: true,
        employeeGovernmentId: { select: { panNumber: true, deletedAt: true } },
      },
    });
    if (!employee) throw new ResourceNotFoundException("Employee", employeeId);

    const start = Number(financialYear.slice(0, 4));
    const entries = await this.prisma.payrollEntry.findMany({
      where: {
        organizationId,
        employeeId,
        deletedAt: null,
        status: { not: "CANCELLED" },
        payrollRun: {
          status: "APPROVED",
          payrollPeriod: {
            status: "FINALIZED",
            periodStart: {
              gte: new Date(Date.UTC(start, 3, 1)),
              lte: new Date(Date.UTC(start + 1, 2, 31)),
            },
          },
        },
      },
      select: {
        totalGrossEarnings: true,
        taxableEarnings: true,
        taxRegime: true,
        payrollRun: {
          select: { payrollPeriod: { select: { year: true, month: true } } },
        },
        deductions: {
          where: { code: { in: ["TDS", "PF"] }, deletedAt: null },
          select: { code: true, amount: true },
        },
      },
      orderBy: { id: "asc" },
    });
    if (entries.length === 0) {
      throw new BusinessRuleViolationException(
        `No finalized payroll for ${employee.employeeCode} in ${financialYear}`,
        "FORM16_NO_PAYROLL",
      );
    }

    const declaration = await this.prisma.employeeTaxDeclaration.findUnique({
      where: { employeeId_financialYear: { employeeId, financialYear } },
    });
    const settings = toRules(
      await this.prisma.payrollSetting.findUnique({
        where: { organizationId },
      }),
    );
    const regime = (declaration?.regime ??
      entries.at(-1)?.taxRegime ??
      settings.defaultTaxRegime) as "OLD" | "NEW";
    const declared = acceptedAmounts(declaration);

    const months = entries
      .map((e) => ({
        year: e.payrollRun.payrollPeriod.year,
        month: e.payrollRun.payrollPeriod.month,
        grossEarnings: Number(e.totalGrossEarnings),
        taxableEarnings: Number(e.taxableEarnings),
        tds: e.deductions
          .filter((d) => d.code === "TDS")
          .reduce((s, d) => s + Number(d.amount), 0),
      }))
      .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
    const employeePf = entries
      .flatMap((e) => e.deductions)
      .filter((d) => d.code === "PF")
      .reduce((s, d) => s + Number(d.amount), 0);
    const sum = (k: "grossEarnings" | "taxableEarnings" | "tds") =>
      round2(months.reduce((s, m) => s + m[k], 0));

    const regimeRow = await this.prisma.incomeTaxRegime.findUnique({
      where: {
        organizationId_financialYear_regime: {
          organizationId,
          financialYear,
          regime,
        },
      },
      include: { slabs: true },
    });
    const rules = regimeRow
      ? {
          regime,
          standardDeduction: Number(regimeRow.standardDeduction),
          rebateIncomeLimit: Number(regimeRow.rebateIncomeLimit),
          rebateMaxAmount: Number(regimeRow.rebateMaxAmount),
          cessPercent: Number(regimeRow.cessPercent),
          section80cLimit: Number(regimeRow.section80cLimit),
          homeLoanInterestLimit: Number(regimeRow.homeLoanInterestLimit),
          slabs: regimeRow.slabs.map((s) => ({
            fromIncome: Number(s.fromIncome),
            toIncome: s.toIncome === null ? null : Number(s.toIncome),
            ratePercent: Number(s.ratePercent),
          })),
        }
      : null;
    const income = round2(
      sum("taxableEarnings") +
        declared.otherIncome +
        declared.previousEmployerIncome,
    );
    const deductions = rules
      ? round2(allowedDeductions(rules, declared, employeePf))
      : 0;
    const taxableIncome = Math.max(0, round2(income - deductions));

    const govId =
      employee.employeeGovernmentId && !employee.employeeGovernmentId.deletedAt
        ? employee.employeeGovernmentId
        : null;
    return {
      financialYear,
      employer: {
        name: settings.companyName,
        address: settings.companyAddress,
        pan: settings.companyPan,
        tan: settings.companyTan,
      },
      employee: {
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        pan: maskTail(govId?.panNumber),
      },
      regime,
      months,
      totals: {
        grossEarnings: sum("grossEarnings"),
        taxableSalary: sum("taxableEarnings"),
        otherIncome: declared.otherIncome,
        previousEmployerIncome: declared.previousEmployerIncome,
        deductions,
        taxableIncome,
        taxPayable: rules ? annualTax(taxableIncome, rules) : null,
        tdsDeducted: sum("tds"),
        previousEmployerTds: declared.previousEmployerTds,
      },
    };
  }
}

export function renderForm16Html(f: Form16): string {
  const row = (label: string, value: unknown) =>
    `<tr><th>${esc(label)}</th><td class="num">${esc(value ?? "—")}</td></tr>`;
  const months = f.months
    .map(
      (m) =>
        `<tr><td>${esc(periodLabel(m))}</td><td class="num">${money(m.grossEarnings)}</td><td class="num">${money(m.taxableEarnings)}</td><td class="num">${money(m.tds)}</td></tr>`,
    )
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>Form 16 ${esc(f.financialYear)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; }
  .num { text-align: right; }
  .muted { color: #555; }
</style></head>
<body>
  <h1>Form 16 — Part B (salary and tax), FY ${esc(f.financialYear)}</h1>
  <div class="muted">Part A (TDS certificate) is issued from the TRACES portal.</div>
  <table>
    <tr><th>Employer</th><td>${esc(f.employer.name ?? "—")}<br />${esc(f.employer.address ?? "")}</td></tr>
    <tr><th>Employer PAN / TAN</th><td>${esc(f.employer.pan ?? "—")} / ${esc(f.employer.tan ?? "—")}</td></tr>
    <tr><th>Employee</th><td>${esc(f.employee.fullName)} (${esc(f.employee.employeeCode)})</td></tr>
    <tr><th>Employee PAN</th><td>${esc(f.employee.pan ?? "—")}</td></tr>
    <tr><th>Tax regime</th><td>${esc(f.regime)}</td></tr>
  </table>
  <table>
    <thead><tr><th>Month</th><th class="num">Gross</th><th class="num">Taxable</th><th class="num">TDS</th></tr></thead>
    <tbody>${months}</tbody>
  </table>
  <table>
    ${row("Gross salary", money(f.totals.grossEarnings))}
    ${row("Taxable salary", money(f.totals.taxableSalary))}
    ${row("Income from previous employer", money(f.totals.previousEmployerIncome))}
    ${row("Other income declared", money(f.totals.otherIncome))}
    ${row("Deductions allowed", money(f.totals.deductions))}
    ${row("Taxable income", money(f.totals.taxableIncome))}
    ${row("Tax payable (incl. cess)", f.totals.taxPayable === null ? "—" : money(f.totals.taxPayable))}
    ${row("TDS deducted by this employer", money(f.totals.tdsDeducted))}
    ${row("TDS by previous employer", money(f.totals.previousEmployerTds))}
  </table>
</body></html>`;
}
