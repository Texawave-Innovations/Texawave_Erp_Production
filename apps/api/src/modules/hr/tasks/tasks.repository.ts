import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
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
  assertApprovable,
  assertEmployeeStatusChange,
  assertReassignable,
  assertReopenable,
  isAwaitingApproval,
  isOverdue,
  type TaskPriority,
  type TaskStatus,
} from "./tasks.rules.js";

const ENTITY_TYPE = "task";
const EXIT_STATUSES = ["RESIGNED", "TERMINATED"];
/** Statuses that can still be overdue (legacy: not DONE and not CANCELLED). */
const OPEN_STATUSES: TaskStatus[] = ["PENDING", "IN_PROGRESS"];

const INCLUDE = {
  assignee: { select: { id: true, fullName: true } },
  assignedByUser: { select: { id: true, fullName: true } },
  approvedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.TaskInclude;
type TaskRow = Prisma.TaskGetPayload<{ include: typeof INCLUDE }>;

/** Team/own scope reaches tasks THROUGH the assignee. */
const VIA_ASSIGNEE = {
  teamField: "assignee.teamId",
  ownerField: "assignee.userId",
};

export interface TaskFilter {
  status?: TaskStatus | undefined;
  priority?: TaskPriority | undefined;
  assigneeId?: number | undefined;
  q?: string | undefined;
  awaitingApproval?: boolean | undefined;
  overdue?: boolean | undefined;
  /** The organization's current day (IST), `YYYY-MM-DD`. */
  today: string;
}

export interface NewTask {
  title: string;
  description?: string | undefined;
  assigneeId: number;
  dueDate: string;
  priority: TaskPriority;
}

export interface NewEmployeeTask {
  title: string;
  description?: string | undefined;
  dueDate: string;
  priority: TaskPriority;
  requestToAdmin: boolean;
}

export interface TaskView {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  isOverdue: boolean;
  awaitingApproval: boolean;
  assignee: { id: number; fullName: string };
  assignedBy: { id: number; fullName: string };
  isEmployeeCreated: boolean;
  requestToAdmin: boolean;
  adminApproved: boolean;
  approvedBy: { id: number; fullName: string } | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toView(row: TaskRow, today: string): TaskView {
  const dueDate = formatDateOnly(row.dueDate);
  const status = row.status as TaskStatus;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status,
    priority: row.priority as TaskPriority,
    dueDate,
    isOverdue: isOverdue(status, dueDate, today),
    awaitingApproval: isAwaitingApproval({
      status,
      adminApproved: row.adminApproved,
    }),
    assignee: { id: row.assignee.id, fullName: row.assignee.fullName },
    assignedBy: {
      id: row.assignedByUser.id,
      fullName: row.assignedByUser.fullName,
    },
    isEmployeeCreated: row.isEmployeeCreated,
    requestToAdmin: row.requestToAdmin,
    adminApproved: row.adminApproved,
    approvedBy: row.approvedByUser
      ? { id: row.approvedByUser.id, fullName: row.approvedByUser.fullName }
      : null,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Audit snapshot: business facts only. Title and description are free text
 * and are kept out, as the work-log snapshot keeps its task description out. */
function snapshot(row: TaskRow) {
  return {
    assigneeId: row.assigneeId,
    status: row.status,
    priority: row.priority,
    dueDate: formatDateOnly(row.dueDate),
    isEmployeeCreated: row.isEmployeeCreated,
    adminApproved: row.adminApproved,
  };
}

function filterWhere(filter: TaskFilter): Prisma.TaskWhereInput {
  const clauses: Prisma.TaskWhereInput[] = [];
  if (filter.status) clauses.push({ status: filter.status });
  if (filter.priority) clauses.push({ priority: filter.priority });
  if (filter.assigneeId !== undefined) {
    clauses.push({ assigneeId: filter.assigneeId });
  }
  if (filter.q) {
    clauses.push({
      OR: [
        { title: { contains: filter.q, mode: "insensitive" } },
        {
          assignee: {
            fullName: { contains: filter.q, mode: "insensitive" },
          },
        },
      ],
    });
  }
  if (filter.awaitingApproval) {
    clauses.push({ status: "DONE", adminApproved: false });
  }
  if (filter.overdue) {
    clauses.push({
      status: { in: OPEN_STATUSES },
      dueDate: { lt: parseDateOnly(filter.today) },
    });
  }
  return { AND: clauses };
}

/** Only place `PrismaService` is called for tasks. Reads are scoped through
 * `teamWhere()` / `tenantWhere()`. Writes take a row lock, re-check the
 * lifecycle rule inside the transaction, then write the change and its audit
 * row together, so two concurrent moves cannot both succeed. */
@Injectable()
export class TasksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  // ---- HR view (own · team · all) ------------------------------------------

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: TaskFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(scope, filterWhere(filter), VIA_ASSIGNEE);
    return this.page(where, pagination, filter.today, "desc");
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number, today: string) {
    const row = await this.prisma.task.findFirst({
      where: teamWhere(scope, { id }, VIA_ASSIGNEE),
      include: INCLUDE,
    });
    return row ? toView(row, today) : null;
  }

  // ---- self-service (tasks assigned to OR created by the caller) -----------

  /** The caller's own tasks. `employeeId` is resolved from the JWT by the
   * service, never taken from the client. */
  @OrgScoped()
  async findMine(
    scope: OrgScope,
    employeeId: number,
    filter: TaskFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.TaskWhereInput>(scope, {
      AND: [filterWhere(filter), mineWhere(employeeId)],
    });
    return this.page(where, pagination, filter.today, "asc");
  }

  @OrgScoped()
  async findMineOne(
    scope: OrgScope,
    employeeId: number,
    id: number,
    today: string,
  ) {
    const row = await this.prisma.task.findFirst({
      where: tenantWhere<Prisma.TaskWhereInput>(scope, {
        AND: [{ id }, mineWhere(employeeId)],
      }),
      include: INCLUDE,
    });
    return row ? toView(row, today) : null;
  }

  // ---- admin writes (team-scoped) -------------------------------------------

  /** Whether the caller's scope reaches this employee at all. */
  @TeamScoped()
  async employeeVisible(
    scope: TeamScope,
    employeeId: number,
  ): Promise<boolean> {
    const found = await this.prisma.employee.findFirst({
      where: teamWhere(scope, { id: employeeId, deletedAt: null }),
      select: { id: true },
    });
    return found !== null;
  }

  @TeamScoped()
  async create(
    scope: TeamScope,
    input: NewTask,
    actorId: number,
    today: string,
  ): Promise<TaskView> {
    const dueDate = parseDateOnly(input.dueDate);
    return this.prisma.$transaction(async (tx) => {
      // Looked up THROUGH the caller's scope: an employee outside it is
      // indistinguishable from one that does not exist.
      const assignee = await tx.employee.findFirst({
        where: teamWhere(scope, { id: input.assigneeId, deletedAt: null }),
        select: { id: true, status: true },
      });
      if (!assignee) {
        throw new BusinessRuleViolationException(
          `Employee ${input.assigneeId} does not exist in this organization or is not in your scope`,
          "INVALID_ASSIGNEE",
        );
      }
      if (EXIT_STATUSES.includes(assignee.status)) {
        throw new BusinessRuleViolationException(
          "Cannot assign a task to an employee who has left",
          "ASSIGNEE_HAS_LEFT",
        );
      }
      const created = await tx.task.create({
        data: {
          organizationId: scope.organizationId,
          title: input.title,
          description: input.description ?? null,
          assigneeId: input.assigneeId,
          assignedByUserId: actorId,
          dueDate,
          priority: input.priority,
          status: "PENDING",
          isEmployeeCreated: false,
          requestToAdmin: false,
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
      return toView(created, today);
    });
  }

  /** Reassigns an open, admin-assigned task. Reassigning to the current
   * assignee is a no-op. */
  @TeamScoped()
  async reassign(
    scope: TeamScope,
    id: number,
    newAssigneeId: number,
    actorId: number,
    today: string,
  ): Promise<TaskView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.task.findFirst({
        where: teamWhere(scope, { id }, VIA_ASSIGNEE),
        include: INCLUDE,
      });
      if (!before) return null;
      assertReassignable(
        {
          status: before.status as TaskStatus,
          adminApproved: before.adminApproved,
        },
        before.isEmployeeCreated,
      );
      if (newAssigneeId === before.assigneeId) return toView(before, today);

      const assignee = await tx.employee.findFirst({
        where: teamWhere(scope, { id: newAssigneeId, deletedAt: null }),
        select: { id: true, status: true },
      });
      if (!assignee || EXIT_STATUSES.includes(assignee.status)) {
        throw new BusinessRuleViolationException(
          `Employee ${newAssigneeId} cannot receive this task (not found, not in your scope, or has left)`,
          "INVALID_ASSIGNEE",
        );
      }
      const after = await tx.task.update({
        where: { id },
        data: { assigneeId: newAssigneeId, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "reassign",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after, today);
    });
  }

  @TeamScoped()
  async setStatus(
    scope: TeamScope,
    id: number,
    target: TaskStatus,
    actorId: number,
    today: string,
  ): Promise<TaskView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.task.findFirst({
        where: teamWhere(scope, { id }, VIA_ASSIGNEE),
        include: INCLUDE,
      });
      if (!before) return null;
      const noChange = assertAdminStatusChange(
        {
          status: before.status as TaskStatus,
          adminApproved: before.adminApproved,
        },
        target,
      );
      if (noChange) return toView(before, today);
      const after = await tx.task.update({
        where: { id },
        data: { status: target, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "status_change",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after, today);
    });
  }

  @TeamScoped()
  async approve(
    scope: TeamScope,
    id: number,
    actorId: number,
    today: string,
  ): Promise<TaskView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.task.findFirst({
        where: teamWhere(scope, { id }, VIA_ASSIGNEE),
        include: INCLUDE,
      });
      if (!before) return null;
      assertApprovable({
        status: before.status as TaskStatus,
        adminApproved: before.adminApproved,
      });
      const after = await tx.task.update({
        where: { id },
        data: {
          adminApproved: true,
          approvedByUserId: actorId,
          approvedAt: new Date(),
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "approve",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after, today);
    });
  }

  @TeamScoped()
  async reopen(
    scope: TeamScope,
    id: number,
    actorId: number,
    today: string,
  ): Promise<TaskView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.task.findFirst({
        where: teamWhere(scope, { id }, VIA_ASSIGNEE),
        include: INCLUDE,
      });
      if (!before) return null;
      assertReopenable({
        status: before.status as TaskStatus,
        adminApproved: before.adminApproved,
      });
      const after = await tx.task.update({
        where: { id },
        data: { status: "IN_PROGRESS", updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "reopen",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after, today);
    });
  }

  // ---- self-service writes (own tasks only) ---------------------------------

  @OrgScoped()
  async createForEmployee(
    scope: OrgScope,
    employeeId: number,
    input: NewEmployeeTask,
    actorId: number,
    today: string,
  ): Promise<TaskView> {
    const dueDate = parseDateOnly(input.dueDate);
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: employeeId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { id: true, status: true },
      });
      if (!employee || EXIT_STATUSES.includes(employee.status)) {
        throw new BusinessRuleViolationException(
          "Only an active employee can create tasks",
          "NOT_AN_ACTIVE_EMPLOYEE",
        );
      }
      const created = await tx.task.create({
        data: {
          organizationId: scope.organizationId,
          title: input.title,
          description: input.description ?? null,
          assigneeId: employeeId,
          assignedByUserId: actorId,
          createdByEmployeeId: employeeId,
          dueDate,
          priority: input.priority,
          status: "PENDING",
          isEmployeeCreated: true,
          requestToAdmin: input.requestToAdmin,
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
      return toView(created, today);
    });
  }

  @OrgScoped()
  async setOwnStatus(
    scope: OrgScope,
    employeeId: number,
    id: number,
    target: TaskStatus,
    actorId: number,
    today: string,
  ): Promise<TaskView | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, scope.organizationId, id);
      const before = await tx.task.findFirst({
        where: tenantWhere<Prisma.TaskWhereInput>(scope, {
          AND: [{ id }, mineWhere(employeeId)],
        }),
        include: INCLUDE,
      });
      if (!before) return null;
      assertEmployeeStatusChange(
        {
          status: before.status as TaskStatus,
          adminApproved: before.adminApproved,
        },
        target,
      );
      const after = await tx.task.update({
        where: { id },
        data: { status: target, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "status_change",
        before: snapshot(before),
        after: snapshot(after),
      });
      return toView(after, today);
    });
  }

  private async lock(
    tx: Prisma.TransactionClient,
    organizationId: number,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM hr.tasks
       WHERE id = ${id} AND organization_id = ${organizationId} FOR UPDATE`;
  }

  private async page(
    where: Prisma.TaskWhereInput,
    pagination: PaginationDto,
    today: string,
    defaultOrder: "asc" | "desc",
  ) {
    // HR list: newest first (legacy `createdAt` desc). Self list: earliest due
    // first. Legacy also sorted by priority; that needs a rank column, so it
    // is an open production decision, not silently approximated here.
    const orderBy: Prisma.TaskOrderByWithRelationInput[] =
      defaultOrder === "desc"
        ? [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }]
        : [{ dueDate: pagination.order ?? "asc" }, { id: "asc" }];
    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items: rows.map((r) => toView(r, today)), total };
  }
}

/** Tasks assigned to the caller OR created by the caller (legacy MyTasks). */
function mineWhere(employeeId: number): Prisma.TaskWhereInput {
  return {
    OR: [{ assigneeId: employeeId }, { createdByEmployeeId: employeeId }],
  };
}
