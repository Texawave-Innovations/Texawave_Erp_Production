import { Injectable, Logger } from "@nestjs/common";
import type { NewNotification } from "../../../platform/notifications/notifications.repository.js";
import { NotificationsService } from "../../../platform/notifications/notifications.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  LeaveRequestsRepository,
  type LeaveNotificationFacts,
  today,
} from "./leave-requests.repository.js";
import type { LeaveDelegationView } from "./leave-delegations.repository.js";

/** Where each recipient acts on a leave notification. */
const EMPLOYEE_LINK = "/portal/leave";
const APPROVER_LINK = "/hr/leaves";

export type LeaveEvent =
  | { kind: "submitted"; onBehalf: boolean; resubmitted: boolean }
  | { kind: "first_approved" }
  | { kind: "approved" }
  | { kind: "rejected" }
  | { kind: "cancelled"; byHr: boolean; wasApproved: boolean };

/**
 * In-app notifications for leave (Docs/HR_LEAVE.md §6.3). Sent AFTER the
 * change has committed and best effort: a failed notification is logged and
 * never undoes or fails the change. Recipients never include the person who
 * acted, and the employee only through their linked login.
 *
 *  - submitted → the first approvers: the reporting manager and their active
 *    delegates; when there is no reporting manager with a login, the
 *    team/all approvers of the employee's team. On behalf → also the employee.
 *  - first approval (two-level) → the employee, and HR (`.all` approvers).
 *  - approved / rejected → the employee.
 *  - cancelled by HR → the employee; withdrawn by the employee after
 *    approval → whoever approved it.
 */
@Injectable()
export class LeaveNotificationsService {
  private readonly logger = new Logger(LeaveNotificationsService.name);

  constructor(
    private readonly repository: LeaveRequestsRepository,
    private readonly notifications: NotificationsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async leaveChanged(requestId: number, event: LeaveEvent): Promise<void> {
    try {
      const scope = this.tenantContext.getOrgScope();
      const facts = await this.repository.notificationFacts(scope, requestId);
      if (!facts) return;
      const actorId = this.tenantContext.getUserId();
      const items = await this.build(facts, event);
      const stamp = new Date().toISOString();
      const unique = new Map<number, NewNotification>();
      for (const item of items) {
        if (item.userId === actorId || unique.has(item.userId)) continue;
        unique.set(item.userId, {
          ...item,
          dedupKey: `${item.type}:${facts.id}:${stamp}`,
        });
      }
      await this.notifications.notify(scope, [...unique.values()]);
    } catch (error) {
      this.logger.warn(
        `could not send notifications for leave request ${requestId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Tells the delegate they may now approve for the delegator. */
  async delegationCreated(view: LeaveDelegationView): Promise<void> {
    try {
      await this.notifications.notify(this.tenantContext.getOrgScope(), [
        {
          userId: view.delegate.id,
          type: "leave.delegation_created",
          title: "You are a leave approver",
          body: `${view.delegator.fullName} asked you to approve leave for their team from ${view.startDate} to ${view.endDate}.`,
          link: APPROVER_LINK,
          dedupKey: `leave.delegation_created:${view.id}`,
        },
      ]);
    } catch (error) {
      this.logger.warn(
        `could not notify the delegate of leave delegation ${view.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async build(
    f: LeaveNotificationFacts,
    event: LeaveEvent,
  ): Promise<Omit<NewNotification, "dedupKey">[]> {
    const span =
      f.startDate === f.endDate
        ? f.startDate
        : `${f.startDate} to ${f.endDate}`;
    const what = `${f.leaveTypeName}, ${span} (${f.leaveDays} day${f.leaveDays === 1 ? "" : "s"})`;
    const who = `${f.employeeName} (${f.employeeCode})`;
    const toEmployee = (type: string, title: string, body: string) =>
      f.employeeUserId === null
        ? []
        : [
            {
              userId: f.employeeUserId,
              type,
              title,
              body,
              link: EMPLOYEE_LINK,
            },
          ];
    const toUsers = (
      ids: number[],
      type: string,
      title: string,
      body: string,
    ) =>
      ids
        .filter((id) => id !== f.employeeUserId)
        .map((userId) => ({ userId, type, title, body, link: APPROVER_LINK }));

    switch (event.kind) {
      case "submitted": {
        const approvers = await this.firstApprovers(f);
        const verb = event.resubmitted ? "resubmitted" : "requested";
        return [
          ...toUsers(
            approvers,
            "leave.submitted",
            "Leave waiting for your approval",
            `${who} ${verb} ${what}.`,
          ),
          ...(event.onBehalf
            ? toEmployee(
                "leave.submitted_on_behalf",
                "Leave applied for you",
                `HR applied ${what} on your behalf. It now waits for approval.`,
              )
            : []),
        ];
      }
      case "first_approved": {
        const scope = this.tenantContext.getOrgScope();
        const hr = await this.repository.usersWithApprove(scope, ["all"], null);
        return [
          ...toEmployee(
            "leave.first_approved",
            "Leave approved by your manager",
            `${what} has its first approval and now waits for HR.`,
          ),
          ...toUsers(
            hr.filter((id) => id !== f.firstDecidedBy),
            "leave.awaiting_hr",
            "Leave waiting for HR approval",
            `${who}: ${what} has its first approval.`,
          ),
        ];
      }
      case "approved":
        return toEmployee(
          "leave.approved",
          "Leave approved",
          `${what} is approved.${f.decisionNote ? ` Note: ${f.decisionNote}` : ""}`,
        );
      case "rejected":
        return toEmployee(
          "leave.rejected",
          "Leave rejected",
          `${what} is rejected. Reason: ${f.decisionNote ?? ""}`.trim(),
        );
      case "cancelled":
        if (event.byHr) {
          return toEmployee(
            "leave.cancelled_by_hr",
            "Leave cancelled by HR",
            `${what} was cancelled. Reason: ${f.cancellationNote ?? ""}`.trim(),
          );
        }
        if (!event.wasApproved) return [];
        return toUsers(
          [f.decidedBy, f.firstDecidedBy].filter(
            (id): id is number => id !== null,
          ),
          "leave.withdrawn",
          "Approved leave withdrawn",
          `${who} withdrew ${what}.`,
        );
    }
  }

  /** The reporting manager and their delegates today; when the employee has
   * no reporting manager with a login, the approvers of the employee's team. */
  private async firstApprovers(f: LeaveNotificationFacts): Promise<number[]> {
    const scope = this.tenantContext.getOrgScope();
    if (f.managerUserId !== null) {
      const delegates = await this.repository.activeDelegatesOf(
        scope,
        [f.managerUserId],
        today(),
      );
      return [f.managerUserId, ...delegates];
    }
    return this.repository.usersWithApprove(scope, ["team", "all"], f.teamId);
  }
}
