import { Injectable, Logger } from "@nestjs/common";
import type { NewNotification } from "../../../../platform/notifications/notifications.repository.js";
import { NotificationsService } from "../../../../platform/notifications/notifications.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { LoansRepository } from "./loans.repository.js";

/** Where each recipient acts on a loan notification. */
const HR_LINK = "/hr/payroll?tab=loans";
const EMPLOYEE_LINK = "/portal/loans";

export type LoanEvent =
  "requested" | "forwarded" | "hr_rejected" | "approved" | "rejected";

function rupees(value: unknown): string {
  const n = Number(value ?? 0);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN")}`;
}

/**
 * In-app notifications for loan requests (Docs/PAYROLL_AND_COMPLIANCE.md
 * §3.7). Sent AFTER the change has committed and best effort: a failure is
 * logged and never undoes or fails the change. The person who acted is
 * never notified; the employee only through their linked login.
 *
 *  - requested → every HR reviewer (`hr.loan.review.all`, and `.team`
 *    holders of the employee's team);
 *  - forwarded → every final approver (`hr.loan.approve.all`, and `.team`
 *    holders of the team unless the loan is over the limit);
 *  - rejected by HR or the approver, or approved → the employee, and the HR
 *    user who recorded it on their behalf.
 */
@Injectable()
export class LoanNotificationsService {
  private readonly logger = new Logger(LoanNotificationsService.name);

  constructor(
    private readonly repository: LoansRepository,
    private readonly notifications: NotificationsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async loanChanged(loanId: number, event: LoanEvent): Promise<void> {
    try {
      const scope = this.tenantContext.getOrgScope();
      const f = await this.repository.notificationFacts(scope, loanId);
      if (!f) return;
      const actorId = this.tenantContext.getUserId();
      const what = `${f.loanNumber} (${rupees(f.principalAmount)}) for ${f.employee.fullName}`;
      let recipients: number[] = [];
      let type: string;
      let title: string;
      let body: string;
      let link: string;

      switch (event) {
        case "requested":
          recipients = await this.repository.usersHolding(
            scope,
            "hr.loan.review",
            f.employee.teamId,
            true,
          );
          type = "loan.requested";
          title = "Loan request to review";
          body = `${what} waits for HR review.`;
          link = HR_LINK;
          break;
        case "forwarded":
          recipients = await this.repository.usersHolding(
            scope,
            "hr.loan.approve",
            f.employee.teamId,
            !f.limitOverride,
          );
          type = "loan.forwarded";
          title = "Loan awaiting final approval";
          body = `HR forwarded ${what} for final approval.`;
          link = HR_LINK;
          break;
        default: {
          const approved = event === "approved";
          recipients = [f.employee.userId, f.createdBy].filter(
            (id): id is number => id !== null,
          );
          type = approved ? "loan.approved" : "loan.rejected";
          title = approved ? "Loan approved" : "Loan rejected";
          const note =
            event === "hr_rejected" ? f.hrReviewNote : f.decisionNote;
          body = approved
            ? `Loan ${f.loanNumber} (${rupees(f.principalAmount)}) is approved. EMIs are deducted from your salary.`
            : `Loan ${f.loanNumber} was rejected${event === "hr_rejected" ? " at HR review" : ""}${note ? `: ${note}` : "."}`;
          link = EMPLOYEE_LINK;
        }
      }

      const stamp = new Date().toISOString();
      const items: NewNotification[] = [...new Set(recipients)]
        .filter((userId) => userId !== actorId)
        .map((userId) => ({
          userId,
          type,
          title,
          body,
          // The HR user who recorded it acts in the HR workspace.
          link:
            event !== "requested" &&
            event !== "forwarded" &&
            userId !== f.employee.userId
              ? HR_LINK
              : link,
          dedupKey: `${type}:${f.id}:${stamp}`,
        }));
      if (items.length > 0) await this.notifications.notify(scope, items);
    } catch (err) {
      this.logger.warn(
        `Loan ${loanId} ${event} notification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
