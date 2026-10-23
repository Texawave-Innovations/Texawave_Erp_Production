import { HttpStatus, Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../employees/employee-query.service.js";
import { NotificationsService } from "../../../platform/notifications/notifications.service.js";
import type {
  CreateExpenseClaimDto,
  DecideExpenseClaimDto,
  QueryExpenseClaimDto,
  QueryMyExpenseClaimDto,
} from "./dto/expense-claim.dto.js";
import { ExpenseClaimsRepository } from "./expense-claims.repository.js";

const READ = "hr.expense_claim.read";
const DECIDE = "hr.expense_claim.decide";

/** Deciding needs team or all-team reach. An own-level holder gets a 403 here,
 * before any row is read. */
export class ExpenseClaimDecisionScopeException extends BusinessException {
  constructor() {
    super(
      "Deciding an expense claim requires team or all-team scope",
      HttpStatus.FORBIDDEN,
      "DECISION_SCOPE_REQUIRED",
    );
  }
}

@Injectable()
export class ExpenseClaimsService {
  constructor(
    private readonly repository: ExpenseClaimsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employees: EmployeeQueryService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- HR view (own · team · all) ------------------------------------------

  async findAll(query: QueryExpenseClaimDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 — not 403 — outside the caller's scope. */
  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Expense claim", id);
    return row;
  }

  // ---- decision (team · all) ------------------------------------------------

  /** Approves or rejects a PENDING claim. The decision scope and the caller's
   * employee record are both resolved from the JWT. */
  async decide(id: number, dto: DecideExpenseClaimDto) {
    const scope = await this.teamContext.resolveScope(DECIDE);
    if (scope.level === "own") throw new ExpenseClaimDecisionScopeException();
    // `approver` is only used to detect self-approval below; an admin
    // account holding team/all-scope decide without being linked to an
    // employee can never be deciding their own claim (they have no employee
    // row at all), so `null` here is a valid state, not an error.
    const approver = await this.employees.findCurrentEmployeeOrNull();
    const row = await this.repository.decide(
      scope,
      id,
      approver?.id ?? null,
      { status: dto.decision, note: dto.note },
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Expense claim", id);

    if (row.employee?.userId) {
      void this.notifications.notifyUser(
        this.tenantContext.getOrgScope(),
        row.employee.userId,
        {
          type: "expense.decided",
          title: `Expense Claim ${dto.decision === "APPROVED" ? "Approved ✓" : "Rejected"}`,
          body: `Your claim of ₹${Number(row.amount).toLocaleString("en-IN")} was ${dto.decision.toLowerCase()}${dto.note ? `: ${dto.note}` : "."}`,
          link: `/portal/expense-claims?id=${row.id}`,
        },
      );
    }

    return row;
  }

  // ---- self-service (the authenticated user's own employee record) ----------

  /** Submits a claim for the AUTHENTICATED user's employee. The client cannot
   * name an employee. A claim cannot be dated in the future (legacy date input
   * is capped at today). */
  async createForCurrentEmployee(dto: CreateExpenseClaimDto) {
    if (dto.expenseDate > new Date().toISOString().slice(0, 10)) {
      throw new BusinessRuleViolationException(
        "Expense date cannot be in the future",
        "FUTURE_EXPENSE_DATE",
      );
    }
    const employee = await this.employees.getCurrentEmployee();
    const created = await this.repository.create(
      this.tenantContext.getOrgScope(),
      { ...dto, employeeId: employee.id },
      this.tenantContext.getUserId(),
    );

    const callerUserId = this.tenantContext.getUserId();
    void this.notifications.notifyAdmins(
      this.tenantContext.getOrgScope(),
      {
        type: "expense.submitted",
        title: "New Expense Claim for Approval",
        body: `${employee.fullName} submitted an expense claim of ₹${Number(dto.amount).toLocaleString("en-IN")}.`,
        link: `/hr/expense-approvals?id=${created.id}`,
      },
      callerUserId,
    );

    return created;
  }

  async findMine(query: QueryMyExpenseClaimDto) {
    const employee = await this.employees.getCurrentEmployee();
    const { items, total } = await this.repository.findMine(
      this.tenantContext.getOrgScope(),
      employee.id,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  /** 404 for another employee's claim, never 403. */
  async findMineOne(id: number) {
    const employee = await this.employees.getCurrentEmployee();
    const row = await this.repository.findMineOne(
      this.tenantContext.getOrgScope(),
      employee.id,
      id,
    );
    if (!row) throw new ResourceNotFoundException("Expense claim", id);
    return row;
  }
}
