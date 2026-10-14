import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { PayrollSettingsService } from "../settings/payroll-settings.service.js";
import {
  assertNotSelfApproval,
  requireOrgWideScope,
} from "../shared/payroll-scope.js";
import { BonusesRepository } from "./bonuses.repository.js";
import type {
  CreateBonusDto,
  CreateGratuityDto,
  DecideBonusDto,
  QueryBonusDto,
  StatutoryBonusDto,
} from "./dto/bonus.dto.js";
import {
  type BonusMonth,
  gratuity,
  statutoryBonus,
} from "./statutory-bonus.rules.js";

const READ = "hr.bonus.read";
const WRITE = "hr.bonus.write";
const APPROVE = "hr.bonus.approve";

@Injectable()
export class BonusesService {
  constructor(
    private readonly repository: BonusesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly prisma: PrismaService,
    private readonly settings: PayrollSettingsService,
  ) {}

  async create(dto: CreateBonusDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const teamScope = await this.teamContext.resolveScope(WRITE);

    if (dto.payrollPeriodId) {
      await this.assertOpenPeriod(orgScope.organizationId, dto.payrollPeriodId);
    }

    // The repository re-reads the employee through the caller's write scope.
    return this.repository.create(teamScope, dto, userId);
  }

  private async assertOpenPeriod(organizationId: number, id: number) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!period) throw new ResourceNotFoundException("Payroll period", id);
    if (period.status === "FINALIZED") {
      throw new BusinessRuleViolationException(
        "Cannot assign bonus to a finalized payroll period",
        "PERIOD_FINALIZED",
      );
    }
  }

  async findAll(query: QueryBonusDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findById(scope, id);
    if (!row) throw new ResourceNotFoundException("Employee bonus", id);
    return row;
  }

  async decide(id: number, dto: DecideBonusDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const userId = this.tenantContext.getUserId();

    const bonus = await this.repository.findById(scope, id);
    if (!bonus) throw new ResourceNotFoundException("Employee bonus", id);
    // Maker-checker: not the person who raised it, and never the recipient.
    assertNotSelfApproval(bonus.createdBy, userId, "bonus");
    assertNotSelfApproval(bonus.employee.userId, userId, "bonus");

    if (bonus.status !== "PENDING") {
      throw new BusinessRuleViolationException(
        `Bonus is already decided: ${bonus.status}`,
        "ALREADY_DECIDED",
      );
    }

    const decided = await this.repository.decide(
      scope,
      id,
      dto.decision,
      userId,
      dto.note,
    );
    if (!decided) {
      throw new BusinessRuleViolationException(
        "Bonus was decided concurrently",
        "ALREADY_DECIDED",
      );
    }
    return decided;
  }

  /**
   * Statutory bonus for a financial year (Docs/PAYROLL_AND_COMPLIANCE.md
   * §3.10), from its FINALIZED payroll only. Organization-wide, so `.all`.
   * Without `create` it is a preview; with it, every eligible employee who
   * has no statutory bonus for that year yet gets one, PENDING approval
   * like any other bonus (and then paid by a payroll run).
   */
  async statutory(dto: StatutoryBonusDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    requireOrgWideScope(scope, "calculate statutory bonus");
    const orgScope = this.tenantContext.getOrgScope();
    const start = Number(dto.financialYear.slice(0, 4));
    if (Number(dto.financialYear.slice(5)) !== (start + 1) % 100) {
      throw new BusinessRuleViolationException(
        "A financial year is written like 2025-26",
        "FINANCIAL_YEAR_INVALID",
      );
    }
    const rules = await this.settings.rules();
    const entries = await this.repository.finalizedYearEntries(
      orgScope,
      new Date(Date.UTC(start, 3, 1)),
      new Date(Date.UTC(start + 1, 2, 31)),
    );

    const byEmployee = new Map<
      number,
      {
        employee: { id: number; employeeCode: string; fullName: string };
        months: BonusMonth[];
        monthlyBasicDa: number;
      }
    >();
    for (const e of entries) {
      const row = byEmployee.get(e.employeeId) ?? {
        employee: e.employee,
        months: [],
        monthlyBasicDa: 0,
      };
      row.months.push({
        basicDaEarned: e.earnings.reduce(
          (s, x) => s + Number(x.calculatedAmount),
          0,
        ),
        payableDays: Number(e.payableDays),
      });
      // The highest monthly Basic + DA of the year decides eligibility.
      row.monthlyBasicDa = Math.max(
        row.monthlyBasicDa,
        e.earnings.reduce((s, x) => s + Number(x.baseAmount), 0),
      );
      byEmployee.set(e.employeeId, row);
    }

    const already = await this.repository.statutoryBonusAlreadyRaised(
      orgScope,
      dto.financialYear,
    );
    const results = [...byEmployee.values()].map((r) => ({
      employee: r.employee,
      monthlyBasicDa: r.monthlyBasicDa,
      alreadyRaised: already.has(r.employee.id),
      ...statutoryBonus(r.monthlyBasicDa, r.months, rules),
    }));

    let createdIds: number[] = [];
    if (dto.create) {
      const toCreate = results.filter(
        (r) => r.eligible && r.amount > 0 && !r.alreadyRaised,
      );
      if (toCreate.length > 0) {
        createdIds = await this.repository.createStatutoryBonuses(
          orgScope,
          dto.financialYear,
          toCreate.map((r) => ({
            employeeId: r.employee.id,
            amount: r.amount,
            workedDays: r.workedDays,
          })),
          this.tenantContext.getUserId(),
        );
      }
    }
    return {
      financialYear: dto.financialYear,
      rules: {
        eligibilityLimit: rules.bonusEligibilityLimit,
        calculationCeiling: rules.bonusCalculationCeiling,
        percent: rules.bonusPercent,
      },
      employees: results,
      createdBonusIds: createdIds,
    };
  }

  /** Gratuity due to one employee as of a date (default: exit date, else
   * today) — a calculation only. */
  async gratuityFor(employeeId: number, asOf?: string) {
    const scope = await this.teamContext.resolveScope(READ);
    return this.calculateGratuity(scope, employeeId, asOf);
  }

  /** Raises the calculated gratuity as a GRATUITY bonus (PENDING approval);
   * payroll then pays it (not taxable, not ESI wage). */
  async createGratuity(dto: CreateGratuityDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const result = await this.calculateGratuity(
      scope,
      dto.employeeId,
      dto.asOf,
    );
    if (!result.eligible || result.amount <= 0) {
      throw new BusinessRuleViolationException(
        result.reason ?? "No gratuity is due",
        "GRATUITY_NOT_ELIGIBLE",
      );
    }
    if (dto.payrollPeriodId) {
      await this.assertOpenPeriod(
        this.tenantContext.getOrgScope().organizationId,
        dto.payrollPeriodId,
      );
    }
    return this.repository.create(
      scope,
      {
        employeeId: dto.employeeId,
        bonusType: "GRATUITY",
        amount: result.amount,
        calculationBase: `${result.countedYears} year(s) x ${result.lastDrawnWage} x 15/26`,
        tenureMonths: result.completedYears * 12,
        ...(dto.payrollPeriodId
          ? { payrollPeriodId: dto.payrollPeriodId }
          : {}),
        reason: `Gratuity as of ${result.asOf}`,
      },
      this.tenantContext.getUserId(),
    );
  }

  private async calculateGratuity(
    scope: Awaited<ReturnType<TeamContextService["resolveScope"]>>,
    employeeId: number,
    asOfStr?: string,
  ) {
    const probe = await this.repository.gratuityInputs(
      scope,
      employeeId,
      new Date(),
    );
    if (!probe) throw new ResourceNotFoundException("Employee", employeeId);
    const asOf = asOfStr
      ? parseDateOnly(asOfStr)
      : (probe.dateOfExit ??
        parseDateOnly(new Date().toISOString().slice(0, 10)));
    const employee = await this.repository.gratuityInputs(
      scope,
      employeeId,
      asOf,
    );
    const salary = employee?.salaries[0];
    if (!employee || !salary) {
      throw new BusinessRuleViolationException(
        "The employee has no salary structure on that date",
        "SALARY_NOT_CONFIGURED",
      );
    }
    const monthlyBasicDa =
      salary.components.length > 0
        ? salary.components.reduce((s, c) => s + Number(c.monthlyAmount), 0)
        : Number(salary.basic);
    const rules = await this.settings.rules();
    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
      },
      asOf: asOf.toISOString().slice(0, 10),
      ...gratuity({
        dateOfJoining: employee.dateOfJoining,
        asOf,
        monthlyBasicDa,
        minYears: rules.gratuityMinYears,
        cap: rules.gratuityCap,
      }),
    };
  }
}
