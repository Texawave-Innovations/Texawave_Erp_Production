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
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { EmployeeQueryService } from "../../employees/employee-query.service.js";
import type {
  CreateLoanDto,
  CreateLoanSkipRequestDto,
  DecideLoanSkipRequestDto,
  QueryLoanDto,
} from "./dto/loan.dto.js";
import { LoansRepository } from "./loans.repository.js";
import {
  assertEmployeeInWriteScope,
  assertNotSelfApproval,
} from "../shared/payroll-scope.js";

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

    assertEmployeeInWriteScope(teamScope, employee);
    assertScheduleCoversPrincipal(dto);

    const disbursedDate = parseDateOnly(dto.disbursedDate);
    return this.repository.create(orgScope, dto, disbursedDate, userId);
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
    // Maker-checker: not the requester, and not the borrower.
    assertNotSelfApproval(skipReq.requestedById, userId, "skip request");
    assertNotSelfApproval(skipReq.loan.employee.userId, userId, "skip request");

    if (skipReq.status !== "PENDING") {
      throw new BusinessRuleViolationException(
        `Skip request is already decided: ${skipReq.status}`,
        "ALREADY_DECIDED",
      );
    }

    if (skipReq.payrollPeriod.status === "FINALIZED") {
      throw new BusinessRuleViolationException(
        "Cannot decide a skip request for a finalized period",
        "PERIOD_FINALIZED",
      );
    }

    const decided = await this.repository.decideSkipRequest(
      this.tenantContext.getOrgScope(),
      id,
      dto.decision,
      userId,
    );
    if (!decided) {
      throw new BusinessRuleViolationException(
        "Skip request was decided concurrently",
        "ALREADY_DECIDED",
      );
    }
    return decided;
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

/**
 * The schedule is `emiMonths` installments of `emiAmount`, the last one
 * adjusted to the remainder — so it must cover the principal, and the last
 * installment must be positive and not exceed a regular EMI.
 */
function assertScheduleCoversPrincipal(dto: CreateLoanDto): void {
  const cents = (n: number) => Math.round(n * 100);
  const principal = cents(dto.principalAmount);
  const emi = cents(dto.emiAmount);
  const last = principal - emi * (dto.emiMonths - 1);
  if (last <= 0 || last > emi) {
    throw new BusinessRuleViolationException(
      `EMI ${dto.emiAmount} x ${dto.emiMonths} months does not match principal ${dto.principalAmount}: the last installment would be ${last / 100}`,
      "LOAN_SCHEDULE_INVALID",
    );
  }
}
