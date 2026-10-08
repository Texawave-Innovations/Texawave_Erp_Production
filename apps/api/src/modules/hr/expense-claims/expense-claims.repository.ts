import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessException,
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  ExpenseClaimStatus,
  ExpenseType,
} from "./dto/expense-claim.dto.js";

const ENTITY_TYPE = "expense_claim";

export class ExpenseClaimSelfApprovalForbiddenException extends BusinessException {
  constructor() {
    super(
      "You cannot approve or reject your own expense claim",
      HttpStatus.FORBIDDEN,
      "SELF_APPROVAL_FORBIDDEN",
    );
  }
}

export interface ExpenseClaimFilter {
  employeeId?: number | undefined;
  status?: ExpenseClaimStatus | undefined;
  expenseType?: ExpenseType | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface NewExpenseClaim {
  employeeId: number;
  expenseType: ExpenseType;
  amount: number;
  expenseDate: string;
  description: string;
  receiptRef?: string | undefined;
}

const INCLUDE = {
  employee: {
    select: { id: true, fullName: true, userId: true, teamId: true },
  },
  decider: { select: { id: true, fullName: true } },
} satisfies Prisma.ExpenseClaimInclude;
type ExpenseClaimRow = Prisma.ExpenseClaimGetPayload<{
  include: typeof INCLUDE;
}>;

/** Team/own scope reaches claims THROUGH the employee. */
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

function filterWhere(
  filter: ExpenseClaimFilter,
): Prisma.ExpenseClaimWhereInput {
  const expenseDate: Prisma.DateTimeFilter = {};
  if (filter.from) expenseDate.gte = parseDateOnly(filter.from);
  if (filter.to) expenseDate.lte = parseDateOnly(filter.to);
  return {
    ...(filter.employeeId !== undefined
      ? { employeeId: filter.employeeId }
      : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.expenseType ? { expenseType: filter.expenseType } : {}),
    ...(Object.keys(expenseDate).length > 0 ? { expenseDate } : {}),
  };
}

export interface ExpenseClaimView {
  id: number;
  employee: { id: number; fullName: string };
  expenseType: ExpenseType;
  amount: number;
  expenseDate: string;
  description: string;
  receiptRef: string | null;
  status: ExpenseClaimStatus;
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
}

function toView(row: ExpenseClaimRow): ExpenseClaimView {
  return {
    id: row.id,
    employee: { id: row.employee.id, fullName: row.employee.fullName },
    expenseType: row.expenseType as ExpenseType,
    amount: row.amount.toNumber(),
    expenseDate: formatDateOnly(row.expenseDate),
    description: row.description,
    receiptRef: row.receiptRef,
    status: row.status as ExpenseClaimStatus,
    decidedBy: row.decider,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
  };
}

/** Audit snapshot: business facts only. Description and receipt reference are
 * free text and stay out, as in the work-log and leave snapshots. */
function snapshot(row: ExpenseClaimRow) {
  return {
    employeeId: row.employee.id,
    expenseType: row.expenseType,
    amount: row.amount.toFixed(2),
    expenseDate: formatDateOnly(row.expenseDate),
    status: row.status,
    decidedBy: row.decider?.id ?? null,
  };
}

/** Only place `PrismaService` is called for expense claims. Reads go through
 * `teamWhere()` or `tenantWhere()`; writes are one transaction with the row
 * lock, the change and its audit row. A decision is final. */
@Injectable()
export class ExpenseClaimsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: ExpenseClaimFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(scope, filterWhere(filter), VIA_EMPLOYEE);
    return this.page(where, pagination);
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    const row = await this.prisma.expenseClaim.findFirst({
      where: teamWhere(scope, { id }, VIA_EMPLOYEE),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /** The caller's OWN claims: `employeeId` is resolved from the JWT by the
   * service, never taken from the client. */
  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    filter: ExpenseClaimFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.ExpenseClaimWhereInput>(
      scope,
      filterWhere({ ...filter, employeeId }),
    );
    return this.page(where, pagination);
  }

  /** The caller's own claim by id; `null` (→ 404) for anyone else's. */
  @OrgScoped()
  async findMineOne(scope: OrgScope, employeeId: number, id: number) {
    const row = await this.prisma.expenseClaim.findFirst({
      where: tenantWhere<Prisma.ExpenseClaimWhereInput>(scope, {
        id,
        employeeId,
      }),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: NewExpenseClaim,
    actorId: number,
  ): Promise<ExpenseClaimView> {
    const expenseDate = parseDateOnly(input.expenseDate);
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: input.employeeId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!employee) {
        throw new BusinessRuleViolationException(
          "Employee not found",
          "INVALID_EMPLOYEE",
        );
      }
      const created = await tx.expenseClaim.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          expenseType: input.expenseType,
          amount: input.amount,
          expenseDate,
          description: input.description,
          receiptRef: input.receiptRef ?? null,
          status: "PENDING",
          requestedBy: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return toView(created);
    });
  }

  /**
   * Approves or rejects a PENDING claim inside the caller's decision scope.
   * Lock → find inside the organization AND the scope (else `null` → 404) →
   * refuse the caller's own claim → refuse anything but PENDING → write the
   * decision and its audit row.
   */
  @TeamScoped()
  async decide(
    scope: TeamScope,
    id: number,
    approverEmployeeId: number | null,
    decision: { status: "APPROVED" | "REJECTED"; note: string | undefined },
    actorId: number,
  ): Promise<ExpenseClaimView | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM hr.expense_claims
         WHERE id = ${id} AND organization_id = ${scope.organizationId} FOR UPDATE`;
      const before = await tx.expenseClaim.findFirst({
        where: teamWhere(scope, { id }, VIA_EMPLOYEE),
        include: INCLUDE,
      });
      if (!before) return null;

      if (
        approverEmployeeId !== null &&
        before.employee.id === approverEmployeeId
      ) {
        throw new ExpenseClaimSelfApprovalForbiddenException();
      }
      if (before.status !== "PENDING") {
        throw new InvalidStateTransitionException(
          "Expense claim",
          before.status,
          decision.status,
          "a decided expense claim is final",
        );
      }
      const after = await tx.expenseClaim.update({
        where: { id },
        data: {
          status: decision.status,
          decidedBy: actorId,
          decidedAt: new Date(),
          decisionNote: decision.note ?? null,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: decision.status === "APPROVED" ? "approve" : "reject",
        before: snapshot(before),
        after: snapshot(after),
        reason: decision.note,
      });
      return toView(after);
    });
  }

  private async page(
    where: Prisma.ExpenseClaimWhereInput,
    pagination: PaginationDto,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ expenseDate: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.expenseClaim.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }
}
