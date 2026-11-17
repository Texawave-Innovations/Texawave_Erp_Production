import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import {
  TASK_CATEGORY,
  type DailyStatus,
  type TimesheetStatus,
} from "../timesheets.rules.js";

export interface EnsureTaskRowInput {
  organizationId: number;
  employeeId: number;
  taskId: number;
  projectId: number;
  title: string;
  /** IST business date of the work, `YYYY-MM-DD` (never a UTC date). */
  workDate: string;
  actorUserId: number | null;
  /** Refuse when ANY row of the day is submitted or approved (default). Only
   * the midnight split of a session that is being closed turns this off: that
   * close must always succeed, or a timer could never be stopped. */
  guardDay?: boolean;
}

export interface TimesheetRowRef {
  id: number;
  status: TimesheetStatus;
  dailyStatus: DailyStatus;
  /** true when this call created the row (first work on this task today). */
  created: boolean;
}

interface RawRow {
  id: number;
  status: TimesheetStatus;
  daily_status: DailyStatus;
}

/**
 * Find-or-create of the timesheet row for (employee, IST day, task), always
 * inside the caller's transaction (it is a narrow cross-module write that takes
 * `tx`, Docs/CODING_STANDARDS.md §11). Used by the task lifecycle (PR2) so that
 * Start / Resume reuse the day's row and a new day gets a NEW row — an earlier
 * day's row is never reopened or overwritten.
 *
 * Lock order (documented, and kept by every caller): attendance's
 * `(organization, employee)` advisory lock first, THEN this timesheet lock.
 */
@Injectable()
export class TimesheetDayService {
  /** Serialises timesheet writes for one employee. Transaction-scoped; released
   * on commit/rollback. A separate hashed key on purpose: it must not share
   * attendance/leave's `(org, employee)` lock pair. */
  async lockEmployee(
    tx: Prisma.TransactionClient,
    organizationId: number,
    employeeId: number,
  ): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`timesheet:${organizationId}:${employeeId}`}))::text`;
  }

  /**
   * The row for this task on this IST day: created on first work, reused on
   * every later Start/Resume the same day. Race-safe: the insert targets the
   * partial unique index `timesheets_one_task_per_day_key`, so two concurrent
   * first-starts still yield exactly one row.
   *
   * A day that is already SUBMITTED or APPROVED cannot take new work — the
   * employee has to have it rejected/reopened first (the database trigger
   * would refuse the session anyway; this gives the clear error).
   */
  async ensureTaskRow(
    tx: Prisma.TransactionClient,
    input: EnsureTaskRowInput,
  ): Promise<TimesheetRowRef> {
    // A day under review is closed to new work, whichever task it would be on.
    // (The row of the same task is checked below; this covers every other row.)
    if (input.guardDay !== false) {
      const locked = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS "n"
        FROM "hr"."timesheets"
        WHERE "organization_id" = ${input.organizationId}
          AND "employee_id" = ${input.employeeId}
          AND "work_date" = ${input.workDate}::date
          AND "deleted_at" IS NULL
          AND "status" IN ('SUBMITTED', 'APPROVED')`;
      if ((locked[0]?.n ?? 0) > 0) {
        throw new BusinessRuleViolationException(
          `The timesheet for ${input.workDate} is already submitted or approved; ask for it to be returned before adding more work`,
          "TIMESHEET_LOCKED",
        );
      }
    }

    const inserted = await tx.$queryRaw<{ id: number }[]>`
      INSERT INTO "hr"."timesheets"
        ("organization_id", "employee_id", "work_date", "category", "task_id",
         "project_id", "title", "created_by", "updated_by", "updated_at")
      VALUES
        (${input.organizationId}, ${input.employeeId}, ${input.workDate}::date,
         ${TASK_CATEGORY}, ${input.taskId}, ${input.projectId}, ${input.title},
         ${input.actorUserId}, ${input.actorUserId}, now())
      ON CONFLICT ("organization_id", "employee_id", "work_date", "task_id")
        WHERE "task_id" IS NOT NULL AND "deleted_at" IS NULL
      DO NOTHING
      RETURNING "id"`;

    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT "id", "status", "daily_status"
      FROM "hr"."timesheets"
      WHERE "organization_id" = ${input.organizationId}
        AND "employee_id" = ${input.employeeId}
        AND "work_date" = ${input.workDate}::date
        AND "task_id" = ${input.taskId}
        AND "deleted_at" IS NULL`;
    const row = rows[0];
    if (!row) {
      // Cannot happen after a successful insert-or-conflict inside one transaction.
      throw new Error(
        `timesheet row missing after ensure (employee ${input.employeeId}, task ${input.taskId}, ${input.workDate})`,
      );
    }

    if (row.status === "SUBMITTED" || row.status === "APPROVED") {
      throw new BusinessRuleViolationException(
        `The timesheet for ${input.workDate} is already ${row.status.toLowerCase()}; ask for it to be returned before adding more work`,
        "TIMESHEET_LOCKED",
      );
    }

    return {
      id: row.id,
      status: row.status,
      dailyStatus: row.daily_status,
      created: inserted.length > 0,
    };
  }
}
