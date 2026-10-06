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
import type { Prisma } from "@texawave-erp/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { EmployeeQueryService } from "../../employees/employee-query.service.js";
import type {
  CreateLoanDto,
  CreateLoanSkipRequestDto,
  DecideLoanSkipRequestDto,
  QueryLoanDto,
} from "./dto/loan.dto.js";
import { LoansRepository } from "./loans.repository.js";

const READ = "hr.loan.read";
const WRITE = "hr.loan.write";
const APPROVE = "hr.loan.approve";

@Injectable()
export class LoansService {
  constructor(
    private readonly repository: LoansRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly prisma: PrismaService,
    private readonly employeeQuery: EmployeeQueryService,
  ) {}

  async create(dto: CreateLoanDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const teamScope = await this.teamContext.resolveScope(WRITE);

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

    if (
      teamScope.level === "team" &&
      !teamScope.teamIds.includes(employee.teamId)
    ) {
      throw new ResourceNotFoundException("Employee", dto.employeeId);
    }

    const disbursedDate = parseDateOnly(dto.disbursedDate);

    // Generate loan number
    const count = await this.prisma.employeeLoan.count({
      where: { organizationId: orgScope.organizationId },
    });
    const loanNumber = `LOAN-${String(count + 1).padStart(6, "0")}`;

    return this.repository.create(
      orgScope,
      dto,
      loanNumber,
      disbursedDate,
      userId,
    );
  }

  async findAll(query: QueryLoanDto) {
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
    if (!row) throw new ResourceNotFoundException("Employee loan", id);
    return row;
  }

  async requestSkip(loanId: number, dto: CreateLoanSkipRequestDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const scope = await this.teamContext.resolveScope(WRITE);
    const userId = this.tenantContext.getUserId();

    const loan = await this.repository.findById(scope, loanId);
    if (!loan) throw new ResourceNotFoundException("Employee loan", loanId);

    if (loan.status !== "ACTIVE") {
      throw new BusinessRuleViolationException(
        "Cannot request skip for non-active loan",
        "LOAN_NOT_ACTIVE",
      );
    }

    // Check if period exists
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
        "Cannot request skip for finalized period",
        "PERIOD_FINALIZED",
      );
    }

    // Check duplicate
    const existing = await this.prisma.loanSkipRequest.findFirst({
      where: {
        loanId,
        payrollPeriodId: dto.payrollPeriodId,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ResourceConflictException(
        "A skip request already exists for this loan and payroll period",
      );
    }

    return this.repository.createSkipRequest(
      orgScope,
      loanId,
      dto.payrollPeriodId,
      dto.reason,
      userId,
    );
  }

  async decideSkip(id: number, dto: DecideLoanSkipRequestDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const userId = this.tenantContext.getUserId();

    const skipReq = await this.repository.findSkipRequestById(scope, id);
    if (!skipReq) throw new ResourceNotFoundException("Loan skip request", id);

    if (skipReq.status !== "PENDING") {
      throw new BusinessRuleViolationException(
        `Skip request is already decided: ${skipReq.status}`,
        "ALREADY_DECIDED",
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.loanSkipRequest.update({
        where: { id },
        data: {
          status: dto.decision,
          approvedById: userId,
          approvedAt: new Date(),
          updatedBy: userId,
        },
      });

      if (dto.decision === "APPROVED") {
        // Mark repayment installment if applicable
        await tx.loanRepayment.updateMany({
          where: {
            loanId: skipReq.loanId,
            status: "PENDING",
            dueDate: {
              gte: skipReq.payrollPeriod.id
                ? (
                    await tx.payrollPeriod.findUniqueOrThrow({
                      where: { id: skipReq.payrollPeriodId },
                    })
                  ).periodStart
                : new Date(),
              lte: (
                await tx.payrollPeriod.findUniqueOrThrow({
                  where: { id: skipReq.payrollPeriodId },
                })
              ).periodEnd,
            },
          },
          data: { status: "SKIPPED" },
        });
      }

      return updated;
    });
  }

  async findMyLoans(query?: QueryLoanDto) {
    const employee = await this.employeeQuery.getCurrentEmployee();
    const orgScope = this.tenantContext.getOrgScope();
    const pagination = {
      page: query?.page ?? 1,
      limit: query?.limit ?? 50,
      skip: query?.skip ?? 0,
    };
    const { items, total } = await this.repository.findMine(
      orgScope,
      employee.id,
      query ?? ({} as QueryLoanDto),
      pagination,
    );
    return new PaginatedResponseDto(
      items,
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async findMyLoanById(id: number) {
    const employee = await this.employeeQuery.getCurrentEmployee();
    const orgScope = this.tenantContext.getOrgScope();
    const row = await this.repository.findMineById(orgScope, employee.id, id);
    if (!row) {
      throw new ResourceNotFoundException("Employee loan", id);
    }
    return row;
  }
}
