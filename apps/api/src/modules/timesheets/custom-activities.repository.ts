import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import { parseDateOnly } from "../../common/dates/date-only.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../platform/audit/audit-writer.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import { TimesheetDayService } from "./core/timesheet-day.service.js";
import { TASK_CATEGORY } from "./timesheets.rules.js";

/** What a custom activity row stores. Times are instants built by the server. */
export interface CustomActivityValues {
  category: string;
  title: string;
  description: string | null;
  notes: string | null;
  projectId: number | null;
  /** IST work date, `YYYY-MM-DD`. */
  workDate: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  isBackdated: boolean;
  lateEntryReason: string | null;
}

const ROW_SELECT = {
  id: true,
  category: true,
  title: true,
  description: true,
  notes: true,
  projectId: true,
  workDate: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
  isBackdated: true,
  lateEntryReason: true,
  dailyStatus: true,
  status: true,
  origin: true,
} as const;

/** A short, allow-listed picture of a row for the audit log. */
function snapshot(v: CustomActivityValues) {
  return {
    category: v.category,
    title: v.title,
    workDate: v.workDate,
    startedAt: v.startedAt.toISOString(),
    endedAt: v.endedAt.toISOString(),
    durationMinutes: v.durationMinutes,
    projectId: v.projectId,
    isBackdated: v.isBackdated,
  };
}

/**
 * Writes of custom activities (meetings, discussions, research...). Each is one
 * transaction under the employee's timesheet lock, so two requests cannot both
 * pass the overlap check. The database also refuses overlapping custom
 * intervals (`timesheets_custom_no_overlap`) as a backstop.
 *
 * Rules enforced here because they need the database:
 *  - a day that already has a SUBMITTED or APPROVED row takes no new activity
 *    (a late entry never slips into a submitted or approved day);
 *  - an activity may not overlap another custom activity or a work session of
 *    the same employee;
 *  - only the owner edits or deletes, only while the row is a draft (or was
 *    returned), never a task row, never migrated history.
 */
@Injectable()
export class CustomActivitiesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly day: TimesheetDayService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  create(
    scope: OrgScope,
    employeeId: number,
    userId: number,
    values: CustomActivityValues,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, employeeId);
      await this.assertDayOpen(tx, scope, employeeId, values.workDate);
      await this.assertNoOverlap(tx, scope, employeeId, values);

      const row = await tx.timesheet.create({
        data: {
          organizationId: scope.organizationId,
          employeeId,
          workDate: parseDateOnly(values.workDate),
          category: values.category,
          title: values.title,
          description: values.description,
          notes: values.notes,
          projectId: values.projectId,
          startedAt: values.startedAt,
          endedAt: values.endedAt,
          durationMinutes: values.durationMinutes,
          // A meeting that has been entered is finished work.
          dailyStatus: "COMPLETED",
          isBackdated: values.isBackdated,
          lateEntryReason: values.lateEntryReason,
          createdBy: userId,
          updatedBy: userId,
        },
        select: ROW_SELECT,
      });
      await this.audit.write(tx, {
        entityType: "timesheet_activity",
        entityId: row.id,
        action: "create",
        after: snapshot(values),
        reason: values.lateEntryReason ?? undefined,
      });
      return row;
    });
  }

  @OrgScoped()
  update(
    scope: OrgScope,
    employeeId: number,
    userId: number,
    id: number,
    next: (current: CustomActivityValues) => CustomActivityValues,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, employeeId);
      const existing = await this.findEditable(tx, scope, employeeId, id);
      const before: CustomActivityValues = {
        category: existing.category,
        title: existing.title,
        description: existing.description,
        notes: existing.notes,
        projectId: existing.projectId,
        workDate: existing.workDate.toISOString().slice(0, 10),
        startedAt: existing.startedAt as Date,
        endedAt: existing.endedAt as Date,
        durationMinutes: existing.durationMinutes as number,
        isBackdated: existing.isBackdated,
        lateEntryReason: existing.lateEntryReason,
      };
      const values = next(before);

      await this.assertDayOpen(tx, scope, employeeId, values.workDate, id);
      await this.assertNoOverlap(tx, scope, employeeId, values, id);

      const row = await tx.timesheet.update({
        where: { id },
        data: {
          category: values.category,
          title: values.title,
          description: values.description,
          notes: values.notes,
          projectId: values.projectId,
          workDate: parseDateOnly(values.workDate),
          startedAt: values.startedAt,
          endedAt: values.endedAt,
          durationMinutes: values.durationMinutes,
          isBackdated: values.isBackdated,
          lateEntryReason: values.lateEntryReason,
          updatedBy: userId,
        },
        select: ROW_SELECT,
      });
      await this.audit.write(tx, {
        entityType: "timesheet_activity",
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(values),
      });
      return row;
    });
  }

  @OrgScoped()
  remove(scope: OrgScope, employeeId: number, userId: number, id: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.day.lockEmployee(tx, scope.organizationId, employeeId);
      const existing = await this.findEditable(tx, scope, employeeId, id);
      await tx.timesheet.update({
        where: { id },
        data: { deletedAt: new Date(), updatedBy: userId },
      });
      await this.audit.write(tx, {
        entityType: "timesheet_activity",
        entityId: id,
        action: "delete",
        before: {
          category: existing.category,
          title: existing.title,
          workDate: existing.workDate.toISOString().slice(0, 10),
          durationMinutes: existing.durationMinutes,
        },
      });
      return { success: true };
    });
  }

  // ---------------------------------------------------------------------------

  /** The caller's own custom row, still editable. A row that is not theirs, not
   * custom, or already deleted is a 404; a submitted/approved one is refused. */
  private async findEditable(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    employeeId: number,
    id: number,
  ) {
    const row = await tx.timesheet.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        employeeId,
        deletedAt: null,
        category: { not: TASK_CATEGORY },
      },
      select: ROW_SELECT,
    });
    if (!row || row.startedAt === null || row.endedAt === null) {
      throw new ResourceNotFoundException("Activity", id);
    }
    if (row.origin !== "NATIVE") {
      throw new BusinessRuleViolationException(
        "Imported history cannot be edited here",
        "TIMESHEET_LOCKED",
      );
    }
    if (row.status === "SUBMITTED" || row.status === "APPROVED") {
      throw new BusinessRuleViolationException(
        `This activity is on a ${row.status.toLowerCase()} timesheet and can no longer be changed; ask for the timesheet to be returned first`,
        "TIMESHEET_LOCKED",
      );
    }
    return row;
  }

  /** No new or moved activity may land on a day that already has a submitted or
   * approved row — it would silently change a day that is under review. */
  private async assertDayOpen(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    employeeId: number,
    workDate: string,
    excludeId?: number,
  ) {
    const locked = await tx.timesheet.count({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        workDate: parseDateOnly(workDate),
        deletedAt: null,
        status: { in: ["SUBMITTED", "APPROVED"] },
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
    });
    if (locked > 0) {
      throw new BusinessRuleViolationException(
        `The timesheet for ${workDate} is already submitted or approved; ask for it to be returned before adding more work`,
        "TIMESHEET_LOCKED",
      );
    }
  }

  /** The activity may not overlap another custom activity or a work session. */
  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    employeeId: number,
    values: Pick<CustomActivityValues, "startedAt" | "endedAt">,
    excludeId?: number,
  ) {
    const { startedAt, endedAt } = values;
    const [otherActivity, session] = await Promise.all([
      tx.timesheet.findFirst({
        where: {
          organizationId: scope.organizationId,
          employeeId,
          deletedAt: null,
          category: { not: TASK_CATEGORY },
          startedAt: { lt: endedAt },
          endedAt: { gt: startedAt },
          ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
        },
        select: { title: true },
      }),
      // A running timer has no end yet: it overlaps anything after its start.
      tx.projectTimeEntry.findFirst({
        where: {
          organizationId: scope.organizationId,
          employeeId,
          timePrecision: "EXACT",
          startedAt: { lt: endedAt },
          OR: [{ endedAt: null }, { endedAt: { gt: startedAt } }],
        },
        select: { task: { select: { taskCode: true } } },
      }),
    ]);
    if (otherActivity) {
      throw new BusinessRuleViolationException(
        `This overlaps your activity "${otherActivity.title}". Adjust the times.`,
        "ACTIVITY_OVERLAP",
      );
    }
    if (session) {
      throw new BusinessRuleViolationException(
        `This overlaps your work on ${session.task.taskCode}. Adjust the times.`,
        "ACTIVITY_OVERLAP",
      );
    }
  }
}
