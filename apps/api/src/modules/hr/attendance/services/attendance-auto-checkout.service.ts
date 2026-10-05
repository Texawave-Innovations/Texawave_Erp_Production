import { Injectable, Logger } from "@nestjs/common";
import { formatDateOnly } from "../../../../common/dates/date-only.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { AttendanceDayContextRepository } from "../attendance-day-context.repository.js";
import {
  resolveTargetMinutes,
  type EmployeeRef,
} from "./attendance-day-resolver.js";

/**
 * Automatic checkout: closes an open session once the employee has worked
 * their full shift target.
 *
 * AUTHORITATIVE RULE (the ERP's own, see Docs/ATTENDANCE_ARCHITECTURE.md §7.7):
 *   closeAt = checkInAt + targetMinutes(shift for that record's date)
 * A session is closed at `closeAt` (the instant it became due), not at the
 * moment the job ran, so the worked time is correct even when the job runs late.
 *
 * Why this rule: the legacy codebase has two implementations that disagree
 * (Firebase: fixed 19:00 IST; Vercel cron: after each session's own shift
 * target, documented as replacing the fixed cutoff because it truncated late
 * starts). The ERP has no evidence that a fixed cutoff is still intended, and
 * it has real shift targets, so the shift-relative rule is used. The legacy
 * duplication is recorded, not silently resolved.
 *
 * Eligibility: only sessions with no check-out. A session with no resolvable
 * shift target is LEFT OPEN and counted as `noTarget`, because closing it would
 * mean inventing a duration.
 *
 * Safety:
 *  - Every write is conditional on `check_out_at IS NULL`, so a repeated or
 *    overlapping run changes nothing it has already changed.
 *  - One transaction per session, so one failure cannot roll back the rest.
 *  - The clock is passed in (server time) and the business date is IST.
 *  - Each close is audited as a SYSTEM actor (no user), in the same transaction.
 */

export const AUTO_CHECKOUT_LABEL = "attendance.auto_checkout";
/** Sessions examined per organization per run. Anything beyond it is picked up
 * by a later run, which is safe because the rule is idempotent. */
export const AUTO_CHECKOUT_BATCH_SIZE = 500;

export interface OpenSessionForCheckout {
  id: number;
  checkInAt: Date;
  /** Target for the session's business date; null when no shift applies. */
  targetMinutes: number | null;
}

export interface AutoCheckoutPlan {
  closes: { id: number; checkOutAt: Date }[];
  noTarget: number;
  notDue: number;
}

/** Pure decision: which open sessions are due at `asOf`, and when they close. */
export function planAutoCheckouts(
  sessions: readonly OpenSessionForCheckout[],
  asOf: Date,
): AutoCheckoutPlan {
  const plan: AutoCheckoutPlan = { closes: [], noTarget: 0, notDue: 0 };
  for (const session of sessions) {
    if (session.targetMinutes === null || session.targetMinutes <= 0) {
      plan.noTarget += 1;
      continue;
    }
    const closeAt = new Date(
      session.checkInAt.getTime() + session.targetMinutes * 60_000,
    );
    if (closeAt.getTime() > asOf.getTime()) {
      plan.notDue += 1;
      continue;
    }
    plan.closes.push({ id: session.id, checkOutAt: closeAt });
  }
  return plan;
}

export interface AutoCheckoutResult {
  closed: number;
  noTarget: number;
  notDue: number;
}

@Injectable()
export class AttendanceAutoCheckoutService {
  private readonly logger = new Logger(AttendanceAutoCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly dayContext: AttendanceDayContextRepository,
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
              select: { id: true, teamId: true, workLocationId: true },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      take: AUTO_CHECKOUT_BATCH_SIZE,
    });
    if (open.length === 0) return { closed: 0, noTarget: 0, notDue: 0 };

    const employees = new Map<number, EmployeeRef>();
    let from = formatDateOnly(open[0]!.record.attendanceDate);
    let to = from;
    for (const row of open) {
      const date = formatDateOnly(row.record.attendanceDate);
      if (date < from) from = date;
      if (date > to) to = date;
      employees.set(row.record.employee.id, row.record.employee);
    }
    const ctx = await this.dayContext.load(
      { organizationId },
      [...employees.values()],
      from,
      to,
    );

    const sessions: OpenSessionForCheckout[] = open.map((row) => ({
      id: row.id,
      checkInAt: row.checkInAt,
      targetMinutes: resolveTargetMinutes(
        ctx,
        row.record.employee,
        formatDateOnly(row.record.attendanceDate),
      ),
    }));
    const plan = planAutoCheckouts(sessions, asOf);

    let closed = 0;
    for (const close of plan.closes) {
      const wrote = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.attendanceSession.updateMany({
          where: { id: close.id, checkOutAt: null },
          data: { checkOutAt: close.checkOutAt },
        });
        if (count !== 1) return false;
        await this.audit.write(tx, {
          entityType: "attendance_session",
          entityId: close.id,
          action: "auto_checkout",
          before: { checkOutAt: null },
          after: { checkOutAt: close.checkOutAt.toISOString() },
          reason: "Closed automatically at check-in plus the shift target",
          system: { organizationId, label: AUTO_CHECKOUT_LABEL },
        });
        return true;
      });
      if (wrote) closed += 1;
    }
    return { closed, noTarget: plan.noTarget, notDue: plan.notDue };
  }
}
