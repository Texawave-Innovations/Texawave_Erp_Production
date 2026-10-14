import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  assertAdminStatusChange,
  assertEmployeeCanReply,
  assertEmployeeEditable,
  assertHrCanReply,
  isActive,
  isReopen,
  type TicketCategory,
  type TicketStatus,
} from "./tickets.rules.js";

const ENTITY_TYPE = "ticket";
const EXIT_STATUSES = ["RESIGNED", "TERMINATED"];

const INCLUDE = {
  employee: { select: { id: true, fullName: true } },
  raisedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.TicketInclude;
type TicketRow = Prisma.TicketGetPayload<{ include: typeof INCLUDE }>;

const COMMENT_INCLUDE = {
  authorUser: { select: { id: true, fullName: true } },
  authorEmployee: { select: { id: true, fullName: true } },
} satisfies Prisma.TicketCommentInclude;
type CommentRow = Prisma.TicketCommentGetPayload<{
  include: typeof COMMENT_INCLUDE;
}>;

/** Team scope reaches a ticket THROUGH the employee it is about. */
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

export interface TicketFilter {
  status?: TicketStatus | undefined;
  category?: TicketCategory | undefined;
  employeeId?: number | undefined;
  q?: string | undefined;
}

export interface NewTicket {
  employeeId: number;
  category: TicketCategory;
  subject: string;
  description: string;
}

export interface NewEmployeeTicket {
  category: TicketCategory;
  subject: string;
  description: string;
}

export interface TicketCommentView {
  id: number;
  authorKind: "HR" | "EMPLOYEE";
  author: { id: number; fullName: string } | null;
  body: string;
  createdAt: Date;
}

export interface TicketView {
  id: number;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  isActive: boolean;
  raisedByAdmin: boolean;
  raisedBy: { id: number; fullName: string } | null;
  employee: { id: number; fullName: string };
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketDetailView extends TicketView {
  comments: TicketCommentView[];
}

function toView(row: TicketRow): TicketView {
  const status = row.status as TicketStatus;
  return {
    id: row.id,
    category: row.category as TicketCategory,
    subject: row.subject,
    description: row.description,
    status,
    isActive: isActive(status),
    raisedByAdmin: row.raisedByAdmin,
    raisedBy: row.raisedByUser
      ? { id: row.raisedByUser.id, fullName: row.raisedByUser.fullName }
      : null,
    employee: { id: row.employee.id, fullName: row.employee.fullName },
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCommentView(row: CommentRow): TicketCommentView {
  const author = row.authorKind === "HR" ? row.authorUser : row.authorEmployee;
  return {
    id: row.id,
    authorKind: row.authorKind as "HR" | "EMPLOYEE",
    author: author ? { id: author.id, fullName: author.fullName } : null,
    body: row.body,
    createdAt: row.createdAt,
  };
}

/** Audit snapshot: business facts only. Subject, description and comment
 * bodies are free text and are kept out, as the task snapshot keeps its
 * title and description out. */
function snapshot(row: TicketRow) {
  return {
    employeeId: row.employeeId,
    category: row.category,
    status: row.status,
    raisedByAdmin: row.raisedByAdmin,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

/** `includeEmployeeName` is true on the HR list only: an employee searching
 * their own tickets must not be able to match on someone else's name. */
function filterWhere(
  filter: TicketFilter,
  includeEmployeeName: boolean,
): Prisma.TicketWhereInput {
  const clauses: Prisma.TicketWhereInput[] = [];
  if (filter.status) clauses.push({ status: filter.status });
  if (filter.category) clauses.push({ category: filter.category });
  if (filter.employeeId !== undefined) {
    clauses.push({ employeeId: filter.employeeId });
  }
  if (filter.q) {
    const q = { contains: filter.q, mode: "insensitive" as const };
    clauses.push({
      OR: [
        { subject: q },
        { category: q },
        ...(includeEmployeeName ? [{ employee: { fullName: q } }] : []),
      ],
    });
  }
  return { AND: clauses };
}

/** Only place `PrismaService` is called for tickets. Reads are scoped through
 * `teamWhere()` / `tenantWhere()`. Writes take a row lock on the ticket,
 * re-check the lifecycle rule inside the transaction, then write the change
 * and its audit row together, so concurrent moves and replies serialize. */
@Injectable()
export class TicketsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  // ---- HR view (own · team · all) ------------------------------------------

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: TicketFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(scope, filterWhere(filter, true), VIA_EMPLOYEE);
    return this.page(where, pagination);
  }

  @TeamScoped()
  async findOne(
    scope: TeamScope,
    id: number,
  ): Promise<TicketDetailView | null> {
    const row = await this.prisma.ticket.findFirst({
      where: teamWhere(scope, { id }, VIA_EMPLOYEE),
      include: INCLUDE,
    });
    return row ? this.withComments(row) : null;
  }

  // ---- admin writes (team-scoped) -------------------------------------------

  @TeamScoped()
  async create(
    scope: TeamScope,
    input: NewTicket,
    actorId: number,
  ): Promise<TicketDetailView> {
    return this.prisma.$transaction(async (tx) => {
      // Looked up THROUGH the caller's scope: an employee outside it is
      // indistinguishable from one that does not exist.
      const employee = await tx.employee.findFirst({
        where: teamWhere(scope, { id: input.employeeId, deletedAt: null }),
        select: { id: true, status: true },
      });
      if (!employee) {
        throw new BusinessRuleViolationException(
          `Employee ${input.employeeId} does not exist in this organization or is not in your scope`,
          "INVALID_EMPLOYEE",
        );
      }
      if (EXIT_STATUSES.includes(employee.status)) {
        throw new BusinessRuleViolationException(
          "Cannot raise a ticket for an employee who has left",
          "EMPLOYEE_HAS_LEFT",
        );
      }
      const created = await tx.ticket.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          category: input.category,
          subject: input.subject,
          description: input.description,
          status: "OPEN",
          raisedByAdmin: true,
          raisedByUserId: actorId,
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
      return { ...toView(created), comments: [] };
    });
  }

  /** Moves a ticket through the admin lifecycle. Same-status is a no-op: it
   * writes nothing and returns the ticket unchanged. */
  @TeamScoped()
  async setStatus(
    scope: TeamScope,
    id: number,
    target: TicketStatus,
    actorId: number,
  ): Promise<TicketView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.ticket.findFirst({
        where: teamWhere(scope, { id }, VIA_EMPLOYEE),
        include: INCLUDE,
      });
      if (!before) return null;
      const from = before.status as TicketStatus;
      if (
        assertAdminStatusChange(
          { status: from, raisedByAdmin: before.raisedByAdmin },
          target,
        )
      ) {
        return toView(before);
      }
      const closing = target === "RESOLVED" || target === "CLOSED";
      const after = await tx.ticket.update({
        where: { id },
        data: {
          status: target,
          // Stamped on resolve/close; kept on reopen (legacy behavior).
          ...(closing ? { resolvedAt: new Date() } : {}),
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: isReopen(from, target) ? "reopen" : "status_change",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after);
    });
  }

  /** HR reply. Appends a comment; never edits an earlier one. */
  @TeamScoped()
  async addHrComment(
    scope: TeamScope,
    id: number,
    body: string,
    actorId: number,
  ): Promise<TicketCommentView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const ticket = await tx.ticket.findFirst({
        where: teamWhere(scope, { id }, VIA_EMPLOYEE),
        select: { id: true, status: true, raisedByAdmin: true },
      });
      if (!ticket) return null;
      assertHrCanReply({
        status: ticket.status as TicketStatus,
        raisedByAdmin: ticket.raisedByAdmin,
      });
      const comment = await tx.ticketComment.create({
        data: {
          organizationId: scope.organizationId,
          ticketId: id,
          authorKind: "HR",
          authorUserId: actorId,
          body,
        },
        include: COMMENT_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "comment",
        after: { commentId: comment.id, authorKind: "HR" },
      });
      return toCommentView(comment);
    });
  }

  // ---- self-service (tickets the caller raised or HR raised for them) -------

  /** The caller's own tickets. `employeeId` is resolved from the JWT by the
   * service, never taken from the client. */
  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    filter: TicketFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.TicketWhereInput>(scope, {
      AND: [filterWhere(filter, false), { employeeId }],
    });
    return this.page(where, pagination);
  }

  @OrgScoped()
  async findMineOne(
    scope: OrgScope,
    employeeId: number,
    id: number,
  ): Promise<TicketDetailView | null> {
    const row = await this.prisma.ticket.findFirst({
      where: tenantWhere<Prisma.TicketWhereInput>(scope, {
        AND: [{ id }, { employeeId }],
      }),
      include: INCLUDE,
    });
    return row ? this.withComments(row) : null;
  }

  @OrgScoped()
  async createForEmployee(
    scope: OrgScope,
    employeeId: number,
    input: NewEmployeeTicket,
    actorUserId: number,
  ): Promise<TicketDetailView> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          organizationId: scope.organizationId,
          employeeId,
          category: input.category,
          subject: input.subject,
          description: input.description,
          status: "OPEN",
          raisedByAdmin: false,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return { ...toView(created), comments: [] };
    });
  }

  /** Employee edit of their own open, self-raised ticket. */
  @OrgScoped()
  async updateOwn(
    scope: OrgScope,
    employeeId: number,
    id: number,
    input: NewEmployeeTicket,
    actorUserId: number,
  ): Promise<TicketDetailView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.ticket.findFirst({
        where: tenantWhere<Prisma.TicketWhereInput>(scope, {
          AND: [{ id }, { employeeId }],
        }),
        include: INCLUDE,
      });
      if (!before) return null;
      assertEmployeeEditable({
        status: before.status as TicketStatus,
        raisedByAdmin: before.raisedByAdmin,
      });
      const after = await tx.ticket.update({
        where: { id },
        data: {
          category: input.category,
          subject: input.subject,
          description: input.description,
          updatedBy: actorUserId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return {
        ...toView(after),
        comments: await this.comments(tx, scope.organizationId, id),
      };
    });
  }

  /** Employee reply on a ticket HR raised for them. Appends a comment. */
  @OrgScoped()
  async addEmployeeComment(
    scope: OrgScope,
    employeeId: number,
    id: number,
    body: string,
  ): Promise<TicketCommentView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const ticket = await tx.ticket.findFirst({
        where: tenantWhere<Prisma.TicketWhereInput>(scope, {
          AND: [{ id }, { employeeId }],
        }),
        select: { id: true, status: true, raisedByAdmin: true },
      });
      if (!ticket) return null;
      assertEmployeeCanReply({
        status: ticket.status as TicketStatus,
        raisedByAdmin: ticket.raisedByAdmin,
      });
      const comment = await tx.ticketComment.create({
        data: {
          organizationId: scope.organizationId,
          ticketId: id,
          authorKind: "EMPLOYEE",
          authorEmployeeId: employeeId,
          body,
        },
        include: COMMENT_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "comment",
        after: { commentId: comment.id, authorKind: "EMPLOYEE" },
      });
      return toCommentView(comment);
    });
  }

  // ---- helpers --------------------------------------------------------------

  private async withComments(row: TicketRow): Promise<TicketDetailView> {
    return {
      ...toView(row),
      comments: await this.comments(this.prisma, row.organizationId, row.id),
    };
  }

  /** Oldest first, so the thread reads top to bottom. */
  private async comments(
    db: Prisma.TransactionClient | PrismaService,
    organizationId: number,
    ticketId: number,
  ): Promise<TicketCommentView[]> {
    const rows = await db.ticketComment.findMany({
      where: { organizationId, ticketId },
      include: COMMENT_INCLUDE,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toCommentView);
  }

  private async lock(
    tx: Prisma.TransactionClient,
    organizationId: number,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM hr.tickets
       WHERE id = ${id} AND organization_id = ${organizationId} FOR UPDATE`;
  }

  private async page(
    where: Prisma.TicketWhereInput,
    pagination: PaginationDto,
  ) {
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
      { createdAt: pagination.order ?? "desc" },
      { id: "desc" },
    ];
    const [rows, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }
}
