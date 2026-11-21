import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

const SESSION_SELECT = {
  id: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
  closedReason: true,
  reviewState: true,
  source: true,
  timePrecision: true,
  notes: true,
} as const;

/**
 * Reads of the day layer (`hr.timesheets` and the sessions linked to it).
 * Every query is bound to the caller's organization AND employee — the
 * employee always comes from the signed-in user, never from the request.
 */
@Injectable()
export class TimesheetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The employee's rows for one IST work date, with their sessions. */
  @OrgScoped()
  findDayRows(scope: OrgScope, employeeId: number, workDate: Date) {
    return this.prisma.timesheet.findMany({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        workDate,
        deletedAt: null,
      },
      include: {
        task: {
          select: { id: true, taskCode: true, title: true, status: true },
        },
        project: { select: { id: true, projectCode: true, name: true } },
        sessions: { orderBy: { startedAt: "asc" }, select: SESSION_SELECT },
      },
      orderBy: { id: "asc" },
    });
  }

  /** Every row of the employee over a date range (inclusive), drafts included,
   * with the minimum the month view needs. */
  @OrgScoped()
  findRowsInRange(scope: OrgScope, employeeId: number, from: Date, to: Date) {
    return this.prisma.timesheet.findMany({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        workDate: { gte: from, lte: to },
        deletedAt: null,
      },
      select: {
        workDate: true,
        status: true,
        category: true,
        durationMinutes: true,
        endedAt: true,
        sessions: { select: { endedAt: true, durationMinutes: true } },
      },
      orderBy: [{ workDate: "asc" }, { id: "asc" }],
    });
  }

  /** The employee's rows for one task over a date range (inclusive). */
  @OrgScoped()
  findTaskRows(
    scope: OrgScope,
    employeeId: number,
    taskId: number,
    from: Date,
    to: Date,
  ) {
    return this.prisma.timesheet.findMany({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        taskId,
        workDate: { gte: from, lte: to },
        deletedAt: null,
      },
      include: { sessions: { select: SESSION_SELECT } },
      orderBy: { workDate: "asc" },
    });
  }

  /** The task, if it is assigned to the employee or the employee has worked
   * on it — the only tasks whose day history they may read. */
  @OrgScoped()
  async findOwnTask(scope: OrgScope, employeeId: number, taskId: number) {
    return this.prisma.projectTask.findFirst({
      where: {
        id: taskId,
        organizationId: scope.organizationId,
        OR: [
          { assignedToId: employeeId },
          { timesheets: { some: { employeeId, deletedAt: null } } },
        ],
      },
      select: {
        id: true,
        taskCode: true,
        title: true,
        status: true,
        deletedAt: true,
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });
  }
}
