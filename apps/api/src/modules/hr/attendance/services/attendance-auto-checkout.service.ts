import { Injectable, Logger } from "@nestjs/common";
import { formatDateOnly } from "../../../../common/dates/date-only.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import type { NewNotification } from "../../../../platform/notifications/notifications.repository.js";
import { NotificationsService } from "../../../../platform/notifications/notifications.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { AttendanceSettingsRepository } from "../settings/attendance-settings.repository.js";
import {
  effectiveCutoffTime,
  planFixedCheckouts,
  toRules,
} from "../settings/attendance-settings.rules.js";

/**
 * Automatic checkout: closes a forgotten session so it cannot run on forever.
 *
 * AUTHORITATIVE RULE (Docs/ATTENDANCE_ARCHITECTURE.md §7.7):
 *   closeAt = the cut-off on the session's own IST business date — the HR
 *   master's time when switched on, otherwise 23:59 IST (end of day).
 * A session is closed at `closeAt` (the instant it became due), not at the
 * moment the job ran.
 *
 * The close time is TECHNICAL, not a verified check-out: every session closed
 * here is flagged `autoClosed`, and the calculation counts no worked time or
 * overtime from it until HR regularizes it (a manual edit with real times, or
 * an approved correction). Other, verified sessions of the same day still count.
 *
 * Why not "check-in + shift target" (the former default): it closed a session
 * at exactly the target, so time worked past the shift was lost, and it
 * restarted the full target for every session of a day, so a forgotten second
 * session produced overtime that was never worked.
 *
 * Eligibility: only sessions with no check-out.
 *
 * Safety:
 *  - Every write is conditional on `check_out_at IS NULL`, so a repeated or
 *    overlapping run changes nothing it has already changed.
 *  - One transaction per session, so one failure cannot roll back the rest.
 *  - The clock is passed in (server time) and the business date is IST.
 *  - Each close is audited as a SYSTEM actor (no user), in the same transaction.
 *  - After the closes, the employee and their reporting manager are told the
 *    session was closed for them (Docs/HR_API.md → Attendance alerts). That is
 *    best effort: a failed notification never undoes a close.
 */

export const AUTO_CHECKOUT_LABEL = "attendance.auto_checkout";
/** Sessions examined per organization per run. Anything beyond it is picked up
 * by a later run, which is safe because the rule is idempotent. */
export const AUTO_CHECKOUT_BATCH_SIZE = 500;

export interface AutoCheckoutResult {
  closed: number;
  /** Open sessions that cannot be closed inside their own day. */
  noTarget: number;
  notDue: number;
}

@Injectable()
export class AttendanceAutoCheckoutService {
  private readonly logger = new Logger(AttendanceAutoCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly notifications: NotificationsService,
    private readonly settings: AttendanceSettingsRepository,
  ) {}

  /** Runs for every active organization. A failure in one organization is
   * logged and does not stop the others. */
  async runForAllOrganizations(
    asOf: Date,
  ): Promise<AutoCheckoutResult & { failedOrganizations: number }> {
    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const total = { closed: 0, noTarget: 0, notDue: 0, failedOrganizations: 0 };
    for (const org of orgs) {
      try {
        const r = await this.runForOrganization(org.id, asOf);
        total.closed += r.closed;
        total.noTarget += r.noTarget;
        total.notDue += r.notDue;
      } catch (error) {
        total.failedOrganizations += 1;
        this.logger.error(
          `auto-checkout failed for organization ${org.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return total;
  }

  async runForOrganization(
    organizationId: number,
    asOf: Date,
  ): Promise<AutoCheckoutResult> {
    const open = await this.prisma.attendanceSession.findMany({
      where: { checkOutAt: null, record: { organizationId } },
      select: {
        id: true,
        checkInAt: true,
        record: {
          select: {
            attendanceDate: true,
            employee: {
              select: {
                employeeCode: true,
                fullName: true,
                userId: true,
                reportsTo: { select: { userId: true } },
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      take: AUTO_CHECKOUT_BATCH_SIZE,
    });
    if (open.length === 0) return { closed: 0, noTarget: 0, notDue: 0 };

    // The HR master's earlier cut-off when switched on, else end of day. Every
    // close is flagged so the session stays pending until HR regularizes it.
    const cutoff = effectiveCutoffTime(
      toRules(await this.settings.find({ organizationId })),
    );
    const plan = planFixedCheckouts(
      open.map((row) => ({
        id: row.id,
        checkInAt: row.checkInAt,
        attendanceDate: formatDateOnly(row.record.attendanceDate),
      })),
      cutoff,
      asOf,
    );
    const reason = `Closed automatically at the ${cutoff} (IST) cut-off; check-out not recorded, pending HR regularization`;

    let closed = 0;
    const notices: NewNotification[] = [];
    const rowById = new Map(open.map((row) => [row.id, row]));
    for (const close of plan.closes) {
      const wrote = await this.prisma.$transaction(async (tx) => {
        // Conditional on check_out_at IS NULL: a manual check-out that landed
        // first is never overwritten, and a repeated run changes nothing.
        const { count } = await tx.attendanceSession.updateMany({
          where: { id: close.id, checkOutAt: null },
          data: { checkOutAt: close.checkOutAt, autoClosed: true },
        });
        if (count !== 1) return false;
        await this.audit.write(tx, {
          entityType: "attendance_session",
          entityId: close.id,
          action: "auto_checkout",
          before: { checkOutAt: null },
          after: { checkOutAt: close.checkOutAt.toISOString() },
          reason,
          system: { organizationId, label: AUTO_CHECKOUT_LABEL },
        });
        return true;
      });
      if (wrote) {
        closed += 1;
        const row = rowById.get(close.id);
        if (row) {
          notices.push(
            ...autoCheckoutNotifications(
              close.id,
              formatDateOnly(row.record.attendanceDate),
              close.checkOutAt,
              row.record.employee,
            ),
          );
        }
      }
    }
    if (notices.length > 0) {
      try {
        await this.notifications.notify({ organizationId }, notices);
      } catch (error) {
        this.logger.warn(
          `auto-checkout notifications failed for organization ${organizationId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return { closed, noTarget: plan.unclosable, notDue: plan.notDue };
  }
}

const IST_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** The notices for one automatic close: the employee, and their reporting
 * manager when that is a different login. Sent once per session. */
export function autoCheckoutNotifications(
  sessionId: number,
  attendanceDate: string,
  checkOutAt: Date,
  employee: {
    employeeCode?: string;
    fullName?: string;
    userId?: number | null;
    reportsTo?: { userId: number | null } | null;
  },
): NewNotification[] {
  const at = IST_TIME.format(checkOutAt);
  const key = `attendance.auto_checkout:${sessionId}`;
  const items: NewNotification[] = [];
  const userId = employee.userId ?? null;
  const managerUserId = employee.reportsTo?.userId ?? null;
  if (userId !== null) {
    items.push({
      userId,
      type: "attendance.auto_checkout",
      title: "You were checked out automatically",
      body: `You did not check out on ${attendanceDate}, so the system closed your session at ${at} (IST). That is not your check-out time: the session counts no hours until it is regularized. Raise a "Missed check-out" correction with the time you left.`,
      link: "/self-service/attendance",
      dedupKey: key,
    });
  }
  if (managerUserId !== null && managerUserId !== userId) {
    items.push({
      userId: managerUserId,
      type: "attendance.auto_checkout",
      title: `${employee.fullName ?? "An employee"} did not check out`,
      body: `${employee.fullName ?? ""} (${employee.employeeCode ?? ""}) did not check out on ${attendanceDate}; the system closed the session at ${at} (IST). It is pending regularization and counts no hours until then.`,
      link: "/portal/team-attendance",
      dedupKey: key,
    });
  }
  return items;
}
