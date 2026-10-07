import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { requireOrgWideScope } from "../shared/payroll-scope.js";
import type {
  CreatePayrollPeriodDto,
  QueryPayrollPeriodDto,
  UpdatePayrollPeriodDto,
} from "./dto/payroll-period.dto.js";
import { PayrollPeriodsRepository } from "./payroll-periods.repository.js";

const WRITE = "hr.payroll.write";
const FINALIZE = "hr.payroll.finalize";

@Injectable()
export class PayrollPeriodsService {
  constructor(
    private readonly repository: PayrollPeriodsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async create(dto: CreatePayrollPeriodDto) {
    await this.requireWrite();
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const existing = await this.repository.findByYearMonth(
      scope,
      dto.year,
      dto.month,
    );
    if (existing) {
      throw new ResourceConflictException(
        `Payroll period for ${dto.year}-${String(dto.month).padStart(2, "0")} already exists`,
      );
    }

    const startStr =
      dto.periodStart ?? `${dto.year}-${String(dto.month).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(dto.year, dto.month, 0)).getUTCDate();
    const endStr =
      dto.periodEnd ??
      `${dto.year}-${String(dto.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const periodStart = parseDateOnly(startStr);
    const periodEnd = parseDateOnly(endStr);

    if (periodEnd < periodStart) {
      throw new BusinessRuleViolationException(
        "Period end date cannot precede period start date",
        "PERIOD_DATES_INVALID",
      );
    }

    return this.repository.create(
      scope,
      dto,
      { periodStart, periodEnd },
      userId,
    );
  }

  async findAll(query: QueryPayrollPeriodDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const row = await this.repository.findById(scope, id);
    if (!row) throw new ResourceNotFoundException("Payroll period", id);
    return row;
  }

  async update(id: number, dto: UpdatePayrollPeriodDto) {
    await this.requireWrite();
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const current = await this.findOne(id);

    if (current.status === "FINALIZED") {
      throw new BusinessRuleViolationException(
        "Cannot update a finalized payroll period",
        "PAYROLL_FINALIZED",
      );
    }

    if (dto.status) {
      return this.repository.updateStatus(scope, id, dto.status, userId);
    }

    return current;
  }

  async finalize(id: number) {
    const teamScope = await this.teamContext.resolveScope(FINALIZE);
    requireOrgWideScope(teamScope, "finalize payroll periods");
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    const period = await this.repository.finalize(scope, id, userId);
    if (!period) throw new ResourceNotFoundException("Payroll period", id);
    return period;
  }

  private async requireWrite() {
    const teamScope = await this.teamContext.resolveScope(WRITE);
    requireOrgWideScope(teamScope, "manage payroll periods");
  }
}
