import { ForbiddenException, Injectable } from "@nestjs/common";
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
import { PayrollSettingsService } from "../settings/payroll-settings.service.js";
import {
  assertNotSelfApproval,
  findEmployeeInWriteScope,
} from "../shared/payroll-scope.js";
import type {
  CreateLoanDto,
  CreateLoanPrepaymentDto,
  CreateLoanSkipRequestDto,
  DecideLoanDto,
  DecideLoanPrepaymentDto,
  DecideLoanSkipRequestDto,
  QueryLoanDto,
} from "./dto/loan.dto.js";
import { buildSchedule, checkLoanLimits } from "./loan.rules.js";
import { LoansRepository } from "./loans.repository.js";

const READ = "hr.loan.read";
const WRITE = "hr.loan.write";
const APPROVE = "hr.loan.approve";

/**
 * Employee loans (Docs/PAYROLL_AND_COMPLIANCE.md §4.6): a request within the
 * organization's limits → approval by a second person (which builds the
 * schedule) → EMIs recovered by payroll runs, skips and prepayments each
 * approved by a second person too.
 */
@Injectable()
export class LoansService {
  constructor(
    private readonly repository: LoansRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly prisma: PrismaService,
    private readonly employeeQuery: EmployeeQueryService,
    private readonly settings: PayrollSettingsService,
  ) {}

  async create(dto: CreateLoanDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const teamScope = await this.teamContext.resolveScope(WRITE);
    // Out of scope = not found, before anything about the employee is read.
    await findEmployeeInWriteScope(this.prisma, teamScope, dto.employeeId);

    if (
      !buildSchedule(
        dto.principalAmount,
        dto.emiAmount,
        dto.emiMonths,
        new Date(),
      )
    ) {
      const last =
        Math.round(dto.principalAmount * 100) -
        Math.round(dto.emiAmount * 100) * (dto.emiMonths - 1);
      throw new BusinessRuleViolationException(
        `EMI ${dto.emiAmount} x ${dto.emiMonths} months does not match principal ${dto.principalAmount}: the last installment would be ${last / 100}`,
        "LOAN_SCHEDULE_INVALID",
      );
    }

    const disbursedDate = parseDateOnly(dto.disbursedDate);
    const gross = await this.repository.grossOn(
      orgScope,
      dto.employeeId,
      disbursedDate,
    );
    if (gross === null) {
      throw new BusinessRuleViolationException(
        "The employee has no salary structure on the disbursement date; loan limits are based on it",
        "SALARY_NOT_CONFIGURED",
      );
    }
    const rules = await this.settings.rules();
    const limits = checkLoanLimits({
      grossMonthly: gross,
      principal: dto.principalAmount,
      emiAmount: dto.emiAmount,
      otherEmis: await this.repository.otherEmis(orgScope, dto.employeeId),
      maxMultiple: rules.loanMaxMultiple,
      maxEmiPercent: rules.loanMaxEmiPercent,
    });
    if (limits.emiOverLimit) {
      throw new BusinessRuleViolationException(
        `The employee's EMIs would exceed ${rules.loanMaxEmiPercent}% of the gross salary (at most ${limits.maxTotalEmi} a month in total)`,
        "LOAN_EMI_OVER_LIMIT",
      );
    }
    if (limits.overLimit && !dto.overrideReason) {
      throw new BusinessRuleViolationException(
        `The principal exceeds the limit of ${limits.maxPrincipal} (${rules.loanMaxMultiple} × gross). Give an override reason; an organization-wide approver must then approve it.`,
        "LOAN_OVER_LIMIT",
      );
    }

    return this.repository.create(
      teamScope,
      dto,
      disbursedDate,
      limits.overLimit,
      userId,
    );
  }

  /** Maker-checker: neither the person who recorded it nor the borrower may
   * decide; a loan over the limit needs an organization-wide approver. */
  async decide(id: number, dto: DecideLoanDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const userId = this.tenantContext.getUserId();
    const loan = await this.repository.findById(scope, id);
    if (!loan) throw new ResourceNotFoundException("Employee loan", id);
    assertNotSelfApproval(loan.createdBy, userId, "loan");
    assertNotSelfApproval(loan.employee.userId, userId, "loan");
    if (loan.status !== "PENDING_APPROVAL") {
      throw new BusinessRuleViolationException(
        `Loan is already decided: ${loan.status}`,
        "ALREADY_DECIDED",
      );
    }
    if (loan.limitOverride && scope.level !== "all") {
      throw new ForbiddenException(
        "This loan is above the organization's limit; only an organization-wide (.all) approver may decide it",
      );
    }
    if (dto.decision === "REJECTED" && (dto.note?.trim().length ?? 0) < 3) {
      throw new BusinessRuleViolationException(
        "Give a note (at least 3 characters) when rejecting a loan",
        "DECISION_NOTE_REQUIRED",
      );
    }
    const decided = await this.repository.decide(
      scope,
      id,
      dto.decision,
      dto.note?.trim(),
      userId,
    );
    if (!decided) {
      throw new BusinessRuleViolationException(
        "Loan was decided concurrently",
        "ALREADY_DECIDED",
      );
    }
    return decided;
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
      scope,
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
      scope,
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

  /** Records money received outside payroll; it settles nothing until a
   * second person approves it. */
  async requestPrepayment(loanId: number, dto: CreateLoanPrepaymentDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const loan = await this.repository.findById(scope, loanId);
    if (!loan) throw new ResourceNotFoundException("Employee loan", loanId);
    if (loan.status !== "ACTIVE") {
      throw new BusinessRuleViolationException(
        "Only an active loan can be prepaid",
        "LOAN_NOT_ACTIVE",
      );
    }
    const outstanding = loan.repayments
      .filter((r) => r.status === "PENDING" && r.deletedAt === null)
      .reduce((s, r) => s + Number(r.amount), 0);
    if (dto.amount - outstanding > 0.005) {
      throw new BusinessRuleViolationException(
        `The prepayment exceeds the outstanding balance (${Math.round(outstanding * 100) / 100})`,
        "LOAN_PREPAYMENT_EXCEEDS_BALANCE",
      );
    }
    return this.repository.createPrepayment(
      scope,
      loanId,
      {
        amount: dto.amount,
        receivedOn: parseDateOnly(dto.receivedOn),
        reference: dto.reference,
        reason: dto.reason,
      },
      this.tenantContext.getUserId(),
    );
  }

  async decidePrepayment(id: number, dto: DecideLoanPrepaymentDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const userId = this.tenantContext.getUserId();
    const prepayment = await this.repository.findPrepaymentById(scope, id);
    if (!prepayment) throw new ResourceNotFoundException("Loan prepayment", id);
    assertNotSelfApproval(prepayment.requestedById, userId, "prepayment");
    assertNotSelfApproval(
      prepayment.loan.employee.userId,
      userId,
      "prepayment",
    );
    if (prepayment.status !== "PENDING") {
      throw new BusinessRuleViolationException(
        `Prepayment is already decided: ${prepayment.status}`,
        "ALREADY_DECIDED",
      );
    }
    const loan = await this.repository.decidePrepayment(
      scope,
      id,
      dto.decision,
      userId,
    );
    if (!loan) {
      throw new BusinessRuleViolationException(
        "Prepayment was decided concurrently",
        "ALREADY_DECIDED",
      );
    }
    return loan;
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
