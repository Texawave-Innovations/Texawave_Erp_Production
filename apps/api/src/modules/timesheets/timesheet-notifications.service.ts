import { Injectable, Logger } from "@nestjs/common";
import type { NewNotification } from "../../platform/notifications/notifications.repository.js";
import { NotificationsService } from "../../platform/notifications/notifications.service.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { TimesheetWorkflowRepository } from "./timesheet-workflow.repository.js";

const EMPLOYEE_LINK = "/portal/timesheet";
const REVIEW_LINK = "/portal/team-timesheets";

export interface DayRef {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  employeeUserId: number | null;
  /** IST work date, `YYYY-MM-DD`. */
  date: string;
}

export type TimesheetEvent =
  | { kind: "submitted"; leadUserIds: readonly number[] }
  | { kind: "first_approved"; firstDecidedBy: number }
  | { kind: "approved"; note: string | null }
  | { kind: "rejected"; note: string | null }
  | { kind: "reopened"; note: string | null }
  | { kind: "corrected"; fromMinutes: number; toMinutes: number };

/**
 * In-app notifications for the timesheet review (same pattern as leave's
 * `LeaveNotificationsService`): sent AFTER the change has committed and best
 * effort — a failed notification is logged and never undoes or fails the
 * change. Recipients never include the person who acted.
 *
 *  - submitted → the team lead(s) (two-level day) or HR (one-level day).
 *  - first approval → the employee, and HR, who now owe the second approval.
 *  - approved / rejected → the employee (a rejection carries the reason).
 */
@Injectable()
export class TimesheetNotificationsService {
  private readonly logger = new Logger(TimesheetNotificationsService.name);

  constructor(
    private readonly workflow: TimesheetWorkflowRepository,
    private readonly notifications: NotificationsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async dayChanged(day: DayRef, event: TimesheetEvent): Promise<void> {
    try {
      const scope = this.tenantContext.getOrgScope();
      const actorId = this.tenantContext.getUserId();
      const items = await this.build(day, event);
      const stamp = new Date().toISOString();
      const unique = new Map<number, NewNotification>();
      for (const item of items) {
        if (item.userId === actorId || unique.has(item.userId)) continue;
        unique.set(item.userId, {
          ...item,
          dedupKey: `${item.type}:${day.employeeId}:${day.date}:${stamp}`,
        });
      }
      await this.notifications.notify(scope, [...unique.values()]);
    } catch (error) {
      this.logger.warn(
        `could not send notifications for the timesheet of employee ${day.employeeId} on ${day.date}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async build(
    day: DayRef,
    event: TimesheetEvent,
  ): Promise<Omit<NewNotification, "dedupKey">[]> {
    const who = `${day.employeeName} (${day.employeeCode})`;
    const toEmployee = (type: string, title: string, body: string) =>
      day.employeeUserId === null
        ? []
        : [
            {
              userId: day.employeeUserId,
              type,
              title,
              body,
              link: `${EMPLOYEE_LINK}?date=${day.date}`,
            },
          ];
    const toUsers = (
      ids: readonly number[],
      type: string,
      title: string,
      body: string,
    ) =>
      ids
        .filter((id) => id !== day.employeeUserId)
        .map((userId) => ({
          userId,
          type,
          title,
          body,
          link: `${REVIEW_LINK}?employeeId=${day.employeeId}&date=${day.date}`,
        }));

    switch (event.kind) {
      case "submitted": {
        const recipients =
          event.leadUserIds.length > 0
            ? event.leadUserIds
            : await this.workflow.hrApproverUserIds(
                this.tenantContext.getOrgScope(),
              );
        return toUsers(
          recipients,
          "timesheet.submitted",
          "Timesheet waiting for your approval",
          `${who} submitted their timesheet for ${day.date}.`,
        );
      }
      case "first_approved": {
        const hr = await this.workflow.hrApproverUserIds(
          this.tenantContext.getOrgScope(),
        );
        return [
          ...toEmployee(
            "timesheet.first_approved",
            "Timesheet approved by your manager",
            `Your timesheet for ${day.date} has its first approval and now waits for HR.`,
          ),
          ...toUsers(
            hr.filter((id) => id !== event.firstDecidedBy),
            "timesheet.awaiting_hr",
            "Timesheet waiting for HR approval",
            `${who}: the timesheet for ${day.date} has its first approval.`,
          ),
        ];
      }
      case "approved":
        return toEmployee(
          "timesheet.approved",
          "Timesheet approved",
          `Your timesheet for ${day.date} is approved.${event.note ? ` Note: ${event.note}` : ""}`,
        );
      case "reopened":
        return toEmployee(
          "timesheet.reopened",
          "Timesheet reopened",
          `HR reopened your approved timesheet for ${day.date}. Reason: ${event.note ?? ""}`.trim(),
        );
      case "corrected":
        return toEmployee(
          "timesheet.corrected",
          "A timer on your timesheet was corrected",
          `HR confirmed the end of a timer on ${day.date}: ${event.fromMinutes} min became ${event.toMinutes} min.`,
        );
      case "rejected":
        return toEmployee(
          "timesheet.rejected",
          "Timesheet returned",
          `Your timesheet for ${day.date} was returned. Reason: ${event.note ?? ""}`.trim(),
        );
    }
  }
}
