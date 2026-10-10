import { ForbiddenException, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { LIVE_RUN_STATUSES } from "../shared/payroll-claims.js";
import {
  assertNotSelfApproval,
  requireOrgWideScope,
} from "../shared/payroll-scope.js";
import type {
  ApprovePayrollRunDto,
  CreatePayrollRunDto,
  QueryPayrollEntryDto,
  QueryPayrollRunDto,
} from "./dto/payroll-run.dto.js";
import {
  CalculatedEmployeePayroll,
  PayrollCalculatorService,
} from "./payroll-calculator.service.js";
import { PayrollRunsRepository } from "./payroll-runs.repository.js";

const READ = "hr.payroll.read";
const WRITE = "hr.payroll.write";
const APPROVE = "hr.payroll.approve";

/** Periods a run can no longer be created for. */
const CLOSED_PERIOD_STATUSES = ["FINALIZED", "CANCELLED"];

@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly repository: PayrollRunsRepository,
    private readonly calculator: PayrollCalculatorService,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Calculates and stores a new run. A run is org-wide (one approved run per
   * period is what gets paid), so this needs an `.all` grant. Re-running a
   * period supersedes its earlier PROCESSED/APPROVED run (it becomes
   * CANCELLED) — see `PayrollRunsRepository.createRun`. With `employeeIds`,
   * the employees already in that run are recalculated too, so a partial
   * re-run never drops anyone from the period's payable run.
   */
  async createRun(dto: CreatePayrollRunDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    requireOrgWideScope(scope, "process payroll runs");
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const period = await this.prisma.payrollPeriod.findFirst({
      where: {
        id: dto.payrollPeriodId,
        organizationId: orgScope.organizationId,
        deletedAt: null,
      },
    });
    if (!period) {
      throw new ResourceNotFoundException(
        "Payroll period",
        dto.payrollPeriodId,
      );
    }

    if (CLOSED_PERIOD_STATUSES.includes(period.status)) {
      throw new BusinessRuleViolationException(
        `Cannot process payroll for a ${period.status.toLowerCase()} period`,
        "PAYROLL_FINALIZED",
      );
    }

    // The period's current payable run(s). A new run supersedes them, and the
    // repository re-checks under the period lock that they are still the
    // same ones, so the result never silently mixes two runs' inputs.
    const liveRuns = await this.prisma.payrollRun.findMany({
      where: {
        organizationId: orgScope.organizationId,
        payrollPeriodId: period.id,
        status: { in: LIVE_RUN_STATUSES },
      },
      select: {
        id: true,
        entries: { where: { deletedAt: null }, select: { employeeId: true } },
      },
    });
    const liveRunIds = liveRuns.map((r) => r.id);

    // Determine target employees
    let employeeIds: number[] = [];
    if (dto.employeeIds && dto.employeeIds.length > 0) {
      // Recalculating "selected employees" must not drop everyone else from
      // the period's payable run: the employees already in it are carried
      // into the new run (and recalculated) alongside the selected ones.
      const carried = liveRuns.flatMap((r) =>
        r.entries.map((e) => e.employeeId),
      );
      // An explicit list may name RESIGNED/TERMINATED employees (that's how a
      // leaver's final partial month gets paid — the calculator's
      // employment-window check handles the dates), but never INACTIVE ones:
      // they're on a break, not working, and must not be paid.
      const eligible = await this.prisma.employee.findMany({
        where: {
          id: { in: [...new Set([...dto.employeeIds, ...carried])] },
          organizationId: orgScope.organizationId,
          status: { not: "INACTIVE" },
          deletedAt: null,
        },
        select: { id: true },
      });
      employeeIds = eligible.map((e: { id: number }) => e.id);
    } else {
      const activeEmployees = await this.prisma.employee.findMany({
        where: {
          organizationId: orgScope.organizationId,
          status: "ACTIVE",
          deletedAt: null,
          dateOfJoining: { lte: period.periodEnd },
          OR: [
            { dateOfExit: null },
            { dateOfExit: { gte: period.periodStart } },
          ],
        },
        select: { id: true },
      });
      employeeIds = activeEmployees.map((e: { id: number }) => e.id);
    }

    if (employeeIds.length === 0) {
      throw new BusinessRuleViolationException(
        "No eligible employees found for this payroll period",
        "NO_ELIGIBLE_EMPLOYEES",
      );
    }

    // Calculate for all employees (the calculator ignores ids outside the org)
    const calculations: CalculatedEmployeePayroll[] = [];
    for (const empId of employeeIds) {
      const calc = await this.calculator.calculateForEmployee(
        orgScope.organizationId,
        period.id,
        empId,
      );
      if (calc) {
        calculations.push(calc);
      }
    }

    if (calculations.length === 0) {
      throw new BusinessRuleViolationException(
        "No calculations could be generated for the specified employees",
        "CALCULATION_EMPTY",
      );
    }

    return this.repository.createRun(
      orgScope,
      period.id,
      dto.notes,
      userId,
      calculations,
      liveRunIds,
    );
  }

  async findAllRuns(query: QueryPayrollRunDto) {
    await this.requireRunRead();
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findManyRuns(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findRunById(id: number) {
    await this.requireRunRead();
    const scope = this.tenantContext.getOrgScope();
    const run = await this.repository.findRunById(scope, id);
    if (!run) throw new ResourceNotFoundException("Payroll run", id);
    return run;
  }

  /** Org-wide approval (`.all` only), never by the run's creator, and only
   * from PROCESSED — the transition itself is atomic in the repository. */
  async approveRun(id: number, dto: ApprovePayrollRunDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    requireOrgWideScope(scope, "approve payroll runs");
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const run = await this.repository.findRunById(orgScope, id);
    if (!run) throw new ResourceNotFoundException("Payroll run", id);
    assertNotSelfApproval(run.createdById, userId, "payroll run");

    if (run.status === "APPROVED") {
      throw new BusinessRuleViolationException(
        "Payroll run is already approved",
        "RUN_ALREADY_APPROVED",
      );
    }
    if (run.status !== "PROCESSED") {
      throw new BusinessRuleViolationException(
        `Cannot approve run in status ${run.status}`,
        "INVALID_STATE_TRANSITION",
      );
    }

    return this.repository.approveRun(orgScope, id, userId, dto.notes);
  }

  // ---- Entries -------------------------------------------------------------

  async findAllEntries(query: QueryPayrollEntryDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findManyEntries(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findEntryById(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const entry = await this.repository.findEntryById(scope, id);
    if (!entry) throw new ResourceNotFoundException("Payroll entry", id);
    return entry;
  }

  /** Run headers carry no per-employee pay (entries are team-filtered), so
   * `.team` and `.all` may list them; `.own` is for an employee's own
   * entries only. */
  private async requireRunRead() {
    const scope = await this.teamContext.resolveScope(READ);
    if (scope.level === "own") {
      throw new ForbiddenException("You may not view payroll runs");
    }
  }
}
