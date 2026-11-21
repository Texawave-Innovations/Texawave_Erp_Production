import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { periodTag } from "../shared/payroll-locks.js";
import { requireOrgWideScope } from "../shared/payroll-scope.js";
import { csv, ecrText, salaryJournal } from "./payroll-reports.rules.js";

const EXPORT = "hr.payroll.export";

export interface ReportFile {
  content: string;
  fileName: string;
  contentType: string;
}

/**
 * Statutory files and payroll reports (Docs/PAYROLL_AND_COMPLIANCE.md
 * §4.15). Each covers the whole organization for one period, so only an
 * `.all` grant may download them. They read the period's APPROVED run —
 * the statutory files (ECR, ESI, PT, TDS) only once the period is
 * FINALIZED, so nothing is filed that could still change.
 */
@Injectable()
export class PayrollReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly audit: AuditWriter,
  ) {}

  /** Every download is audited: the files carry PAN, UAN, ESI numbers and
   * per-employee pay. The row is written after the file is built and before
   * it is returned, so a failed audit insert means no file leaves
   * (fail-closed). Only the period id, file name (period tag) and size are
   * recorded, never anything from the file. */
  private async audited(
    payrollPeriodId: number,
    action: string,
    build: () => Promise<ReportFile>,
  ): Promise<ReportFile> {
    const file = await build();
    await this.prisma.$transaction((tx) =>
      this.audit.write(tx, {
        entityType: "payroll_period",
        entityId: payrollPeriodId,
        action,
        after: {
          fileName: file.fileName,
          bytes: Buffer.byteLength(file.content, "utf8"),
        },
      }),
    );
    return file;
  }

  pfEcr(id: number) {
    return this.audited(id, "export_pf_ecr", () => this.buildPfEcr(id));
  }

  esiUpload(id: number) {
    return this.audited(id, "export_esi", () => this.buildEsiUpload(id));
  }

  professionalTax(id: number) {
    return this.audited(id, "export_professional_tax", () =>
      this.buildProfessionalTax(id),
    );
  }

  tds(id: number) {
    return this.audited(id, "export_tds", () => this.buildTds(id));
  }

  journal(id: number) {
    return this.audited(id, "export_journal", () => this.buildJournal(id));
  }

  salaryRegister(id: number) {
    return this.audited(id, "export_salary_register", () =>
      this.buildSalaryRegister(id),
    );
  }

  private async load(payrollPeriodId: number, requireFinalized: boolean) {
    const scope = await this.teamContext.resolveScope(EXPORT);
    requireOrgWideScope(scope, "download payroll reports");
    const { organizationId } = this.tenantContext.getOrgScope();
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: payrollPeriodId, organizationId, deletedAt: null },
    });
    if (!period)
      throw new ResourceNotFoundException("Payroll period", payrollPeriodId);
    if (requireFinalized && period.status !== "FINALIZED") {
      throw new BusinessRuleViolationException(
        "Statutory files are produced only for a finalized period",
        "PERIOD_NOT_FINALIZED",
      );
    }
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        organizationId,
        payrollPeriodId,
        status: "APPROVED",
        deletedAt: null,
      },
      orderBy: { runNumber: "desc" },
    });
    if (!run) {
      throw new BusinessRuleViolationException(
        "No approved payroll run exists for this period",
        "NO_APPROVED_RUN",
      );
    }
    const entries = await this.prisma.payrollEntry.findMany({
      where: { organizationId, payrollRunId: run.id, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            dateOfExit: true,
            department: { select: { name: true } },
            team: { select: { name: true } },
            workLocationId: true,
            pfProfile: { select: { uan: true } },
            esiProfile: { select: { insuranceNumber: true } },
            employeeGovernmentId: {
              select: { panNumber: true, deletedAt: true },
            },
          },
        },
        earnings: {
          where: { deletedAt: null },
          select: { code: true, name: true, calculatedAmount: true },
        },
        deductions: {
          where: { deletedAt: null },
          select: { code: true, name: true, amount: true },
        },
        pfContributions: { where: { deletedAt: null } },
        esiContributions: { where: { deletedAt: null } },
      },
      orderBy: { employee: { employeeCode: "asc" } },
    });
    return { period, entries, tag: periodTag(period) };
  }

  /** EPFO ECR v2 text file. Members without a UAN are refused by name. */
  private async buildPfEcr(payrollPeriodId: number): Promise<ReportFile> {
    const { entries, tag } = await this.load(payrollPeriodId, true);
    const members = entries.filter((e) => e.pfContributions.length > 0);
    const missing = members
      .filter((e) => !e.employee.pfProfile?.uan)
      .map((e) => e.employee.employeeCode);
    if (missing.length > 0) {
      throw new BusinessRuleViolationException(
        `UAN missing for: ${missing.join(", ")}`,
        "UAN_MISSING",
      );
    }
    return {
      content: ecrText(
        members.map((e) => {
          const pf = e.pfContributions[0]!;
          return {
            uan: e.employee.pfProfile!.uan!,
            name: e.employee.fullName,
            grossWage: Number(pf.grossWage),
            pfWage: Number(pf.pfWage),
            epsWage: Number(pf.epsWage),
            edliWage: Number(pf.edliWage),
            employeeContribution: Number(pf.employeeContribution),
            epsContribution: Number(pf.epsContribution),
            epfEmployerContribution: Number(pf.epfEmployerContribution),
            ncpDays: Number(pf.ncpDays),
          };
        }),
      ),
      fileName: `ECR_${tag}.txt`,
      contentType: "text/plain; charset=utf-8",
    };
  }

  /** ESIC monthly contribution upload (CSV of the portal's columns). */
  private async buildEsiUpload(payrollPeriodId: number): Promise<ReportFile> {
    const { entries, tag, period } = await this.load(payrollPeriodId, true);
    const rows = entries
      .filter((e) => e.esiContributions.length > 0)
      .map((e) => {
        const esi = e.esiContributions[0]!;
        const days = Math.round(Number(e.payableDays));
        const left =
          e.employee.dateOfExit &&
          e.employee.dateOfExit >= period.periodStart &&
          e.employee.dateOfExit <= period.periodEnd;
        return [
          e.employee.esiProfile?.insuranceNumber ?? "",
          e.employee.fullName,
          days,
          Math.round(Number(esi.esiWage)),
          days === 0 ? "1" : left ? "2" : "",
          left ? e.employee.dateOfExit!.toISOString().slice(0, 10) : "",
        ];
      });
    return {
      content: csv(
        [
          "IP Number",
          "IP Name",
          "No of Days for which wages paid/payable during the month",
          "Total Monthly Wages",
          "Reason Code for Zero workings days",
          "Last Working Day",
        ],
        rows,
      ),
      fileName: `ESI_${tag}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  private async buildProfessionalTax(
    payrollPeriodId: number,
  ): Promise<ReportFile> {
    const { entries, tag } = await this.load(payrollPeriodId, true);
    const rows = entries
      .map((e) => ({
        e,
        pt: e.deductions
          .filter((d) => d.code === "PT")
          .reduce((s, d) => s + Number(d.amount), 0),
      }))
      .filter((r) => r.pt > 0)
      .map(({ e, pt }) => [
        e.employee.employeeCode,
        e.employee.fullName,
        Number(e.totalGrossEarnings),
        pt,
      ]);
    return {
      content: csv(
        ["Employee code", "Name", "Gross earnings", "Professional Tax"],
        rows,
      ),
      fileName: `PT_${tag}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  /** Monthly TDS working (the basis for the 24Q return): full PAN, as the
   * return needs it — hence `.all` only. */
  private async buildTds(payrollPeriodId: number): Promise<ReportFile> {
    const { entries, tag } = await this.load(payrollPeriodId, true);
    const rows = entries
      .map((e) => ({
        e,
        tds: e.deductions
          .filter((d) => d.code === "TDS")
          .reduce((s, d) => s + Number(d.amount), 0),
      }))
      .map(({ e, tds }) => {
        const gov = e.employee.employeeGovernmentId;
        return [
          e.employee.employeeCode,
          e.employee.fullName,
          gov && !gov.deletedAt ? (gov.panNumber ?? "") : "",
          e.taxRegime ?? "",
          Number(e.taxableEarnings),
          tds,
        ];
      });
    return {
      content: csv(
        ["Employee code", "Name", "PAN", "Regime", "Taxable earnings", "TDS"],
        rows,
      ),
      fileName: `TDS_${tag}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  /** The month's salary journal for Finance (balanced debit/credit). */
  private async buildJournal(payrollPeriodId: number): Promise<ReportFile> {
    const { entries, tag } = await this.load(payrollPeriodId, false);
    const earnings = new Map<
      string,
      { code: string; name: string; amount: number }
    >();
    const deductions = new Map<
      string,
      { code: string; name: string; amount: number }
    >();
    let employerPf = 0;
    let employerEdli = 0;
    let pfAdmin = 0;
    let employerEsi = 0;
    let netPayable = 0;
    for (const e of entries) {
      for (const x of e.earnings) {
        const cur = earnings.get(x.code) ?? {
          code: x.code,
          name: x.name,
          amount: 0,
        };
        cur.amount += Number(x.calculatedAmount);
        earnings.set(x.code, cur);
      }
      for (const x of e.deductions) {
        const cur = deductions.get(x.code) ?? {
          code: x.code,
          name: x.name,
          amount: 0,
        };
        cur.amount += Number(x.amount);
        deductions.set(x.code, cur);
      }
      for (const pf of e.pfContributions) {
        employerPf += Number(pf.employerContribution);
        employerEdli += Number(pf.edliContribution);
        pfAdmin += Number(pf.adminCharges);
      }
      for (const esi of e.esiContributions) {
        employerEsi += Number(esi.employerContribution);
      }
      netPayable += Number(e.netPayable);
    }
    const lines = salaryJournal({
      earnings: [...earnings.values()],
      deductions: [...deductions.values()],
      employerPf,
      employerEdli,
      pfAdmin,
      employerEsi,
      netPayable,
    });
    return {
      content: csv(
        ["Account", "Debit", "Credit"],
        lines.map((l) => [l.account, l.debit, l.credit]),
      ),
      fileName: `Journal_${tag}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  /** Salary register: one row per employee, one column per earning and
   * deduction code that occurs in the run (opens in a spreadsheet). */
  private async buildSalaryRegister(
    payrollPeriodId: number,
  ): Promise<ReportFile> {
    const { entries, tag } = await this.load(payrollPeriodId, false);
    const earningCodes = [
      ...new Set(entries.flatMap((e) => e.earnings.map((x) => x.code))),
    ];
    const deductionCodes = [
      ...new Set(entries.flatMap((e) => e.deductions.map((x) => x.code))),
    ];
    const rows = entries.map((e) => [
      e.employee.employeeCode,
      e.employee.fullName,
      e.employee.department?.name ?? "",
      e.employee.team?.name ?? "",
      e.totalCalendarDays,
      Number(e.payableDays),
      Number(e.lopDays),
      Number(e.overtimeMinutes) / 60,
      ...earningCodes.map((c) =>
        e.earnings
          .filter((x) => x.code === c)
          .reduce((sum, x) => sum + Number(x.calculatedAmount), 0),
      ),
      Number(e.totalGrossEarnings),
      ...deductionCodes.map((c) =>
        e.deductions
          .filter((x) => x.code === c)
          .reduce((sum, x) => sum + Number(x.amount), 0),
      ),
      Number(e.totalDeductions),
      Number(e.netPayable),
    ]);
    return {
      content: csv(
        [
          "Employee code",
          "Name",
          "Department",
          "Team",
          "Calendar days",
          "Payable days",
          "LOP days",
          "Overtime hours",
          ...earningCodes,
          "Gross earnings",
          ...deductionCodes,
          "Total deductions",
          "Net payable",
        ],
        rows,
      ),
      fileName: `SalaryRegister_${tag}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }
}
