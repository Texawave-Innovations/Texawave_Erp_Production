import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import type { Prisma } from "@texawave-erp/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type {
  CreatePayrollPeriodDto,
  QueryPayrollPeriodDto,
  UpdatePayrollPeriodDto,
} from "./dto/payroll-period.dto.js";
import { PayrollPeriodsRepository } from "./payroll-periods.repository.js";

@Injectable()
export class PayrollPeriodsService {
  constructor(
    private readonly repository: PayrollPeriodsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreatePayrollPeriodDto) {
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
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const current = await this.findOne(id);

    if (current.status === "FINALIZED") {
      throw new BusinessRuleViolationException(
        "Payroll period is already finalized",
        "PAYROLL_ALREADY_FINALIZED",
      );
    }

    const approvedRun = current.runs?.find((r) => r.status === "APPROVED");
    if (!approvedRun) {
      throw new BusinessRuleViolationException(
        "Cannot finalize payroll period: no approved payroll run exists",
        "NO_APPROVED_RUN",
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const period = await this.repository.finalize(scope, id, userId, tx);

      let seq = await tx.payslip.count({
        where: { organizationId: scope.organizationId },
      });

      const entries = await tx.payrollEntry.findMany({
        where: { payrollRunId: approvedRun.id, deletedAt: null },
      });

      for (const entry of entries) {
        seq++;
        const payslipNumber = `PS-${period.year}${String(period.month).padStart(2, "0")}-${String(seq).padStart(5, "0")}`;

        await tx.payslip.upsert({
          where: { payrollEntryId: entry.id },
          create: {
            organizationId: scope.organizationId,
            payrollPeriodId: id,
            payrollEntryId: entry.id,
            employeeId: entry.employeeId,
            payslipNumber,
            netPayable: entry.netPayable,
            status: "GENERATED",
            createdBy: userId,
            updatedBy: userId,
          },
          update: {
            netPayable: entry.netPayable,
            updatedBy: userId,
          },
        });
      }

      if (entries.length > 0) {
        await tx.loanRepayment.updateMany({
          where: {
            payrollEntryId: { in: entries.map((e: { id: number }) => e.id) },
            status: "PENDING",
          },
          data: {
            status: "PAID",
            paidAt: new Date(),
            updatedBy: userId,
          },
        });
      }

      await tx.employeeBonus.updateMany({
        where: {
          payrollPeriodId: id,
          status: "APPROVED",
        },
        data: {
          status: "PAID",
          updatedBy: userId,
        },
      });

      return period;
    });
  }
}
