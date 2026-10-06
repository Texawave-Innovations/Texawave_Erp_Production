import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
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

@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly repository: PayrollRunsRepository,
    private readonly calculator: PayrollCalculatorService,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly prisma: PrismaService,
  ) {}

  async createRun(dto: CreatePayrollRunDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    await this.teamContext.resolveScope(WRITE);

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

    if (period.status === "FINALIZED") {
      throw new BusinessRuleViolationException(
        "Cannot process payroll for a finalized period",
        "PAYROLL_FINALIZED",
      );
    }

    // Determine target employees
    let employeeIds: number[] = [];
    if (dto.employeeIds && dto.employeeIds.length > 0) {
      employeeIds = dto.employeeIds;
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

    // Calculate for all employees
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

    const runCount = await this.prisma.payrollRun.count({
      where: { payrollPeriodId: period.id },
    });
    const runNumber = runCount + 1;

    return this.repository.createRun(
      orgScope,
      period.id,
      runNumber,
      dto.notes,
      userId,
      calculations,
    );
  }

  async findAllRuns(query: QueryPayrollRunDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findManyRuns(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findRunById(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const run = await this.repository.findRunById(scope, id);
    if (!run) throw new ResourceNotFoundException("Payroll run", id);
    return run;
  }

  async approveRun(id: number, dto: ApprovePayrollRunDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    await this.teamContext.resolveScope(APPROVE);

    const run = await this.repository.findRunById(orgScope, id);
    if (!run) throw new ResourceNotFoundException("Payroll run", id);

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
}
