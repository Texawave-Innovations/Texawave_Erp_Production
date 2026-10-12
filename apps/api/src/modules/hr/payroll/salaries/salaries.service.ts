import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  CreateSalaryDto,
  QuerySalaryDto,
  UpdateSalaryDto,
} from "./dto/salary.dto.js";
import { assertEmployeeInWriteScope } from "../shared/payroll-scope.js";
import { SalariesRepository } from "./salaries.repository.js";

const READ = "hr.salary.read";
const WRITE = "hr.salary.write";

@Injectable()
export class SalariesService {
  constructor(
    private readonly repository: SalariesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateSalaryDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const teamScope = await this.teamContext.resolveScope(WRITE);

    // Verify employee exists
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        organizationId: orgScope.organizationId,
        deletedAt: null,
      },
    });
    if (!employee) {
      throw new ResourceNotFoundException("Employee", dto.employeeId);
    }

    // `.team` only for employees in the caller's teams; `.own` may not set
    // anyone's salary (including their own).
    assertEmployeeInWriteScope(teamScope, employee);

    const from = parseDateOnly(dto.effectiveFrom);
    const to = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : null;

    if (to && to < from) {
      throw new BusinessRuleViolationException(
        "Effective to date cannot precede effective from date",
        "SALARY_DATES_INVALID",
      );
    }

    const clash = await this.repository.findOverlapping(
      orgScope,
      dto.employeeId,
      from,
      to,
    );
    if (clash) {
      throw new BusinessRuleConflictException(
        "Salary structure overlaps an existing salary record for this employee",
        "SALARY_OVERLAP",
      );
    }

    // Recurring monthly gross only: arrears are a one-time payment (paid once
    // by the calculator) and must not inflate the monthly wage used for
    // statutory thresholds.
    const grossMonthly =
      dto.grossMonthly ??
      Number(dto.basic) +
        Number(dto.hra) +
        Number(dto.conveyance ?? 0) +
        Number(dto.otherAllowance ?? 0) +
        Number(dto.specialAllowance ?? 0);

    return this.repository.create(
      orgScope,
      dto,
      from,
      to,
      grossMonthly,
      userId,
    );
  }

  async findAll(query: QuerySalaryDto) {
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
    if (!row) throw new ResourceNotFoundException("Salary structure", id);
    return row;
  }

  async findApplicableOn(employeeId: number, dateStr?: string) {
    const scope = await this.teamContext.resolveScope(READ);
    const date = dateStr ? parseDateOnly(dateStr) : new Date();
    const row = await this.repository.findApplicableOn(scope, employeeId, date);
    if (!row) {
      throw new ResourceNotFoundException(
        "Applicable salary structure for employee",
        employeeId,
      );
    }
    return row;
  }

  async update(id: number, dto: UpdateSalaryDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const current = await this.findOne(id);
    const writeScope = await this.teamContext.resolveScope(WRITE);
    assertEmployeeInWriteScope(writeScope, current.employee);

    let to = current.effectiveTo;
    if (dto.effectiveTo !== undefined) {
      to = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : null;
      if (to && to < current.effectiveFrom) {
        throw new BusinessRuleViolationException(
          "Effective to date cannot precede effective from date",
          "SALARY_DATES_INVALID",
        );
      }
      const clash = await this.repository.findOverlapping(
        orgScope,
        current.employeeId,
        current.effectiveFrom,
        to,
        id,
      );
      if (clash) {
        throw new BusinessRuleConflictException(
          "Salary structure overlaps an existing salary record for this employee",
          "SALARY_OVERLAP",
        );
      }
    }

    let grossMonthly: number | undefined;
    if (
      dto.basic !== undefined ||
      dto.hra !== undefined ||
      dto.conveyance !== undefined ||
      dto.otherAllowance !== undefined ||
      dto.specialAllowance !== undefined
    ) {
      grossMonthly =
        Number(dto.basic ?? current.basic) +
        Number(dto.hra ?? current.hra) +
        Number(dto.conveyance ?? current.conveyance) +
        Number(dto.otherAllowance ?? current.otherAllowance) +
        Number(dto.specialAllowance ?? current.specialAllowance);
    }

    return this.repository.update(
      orgScope,
      id,
      dto,
      dto.effectiveTo !== undefined ? to : undefined,
      grossMonthly,
      userId,
    );
  }
}
