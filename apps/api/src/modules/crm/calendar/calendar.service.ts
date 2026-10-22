import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { PermissionsService } from "../../../platform/roles-permissions/permissions.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { AccountsService } from "../accounts/accounts.service.js";
import { ActivitiesService } from "../activities/activities.service.js";
import { FollowUpsService } from "../follow-ups/follow-ups.service.js";
import { MeetingsService } from "../meetings/meetings.service.js";
import { OpportunitiesService } from "../opportunities/opportunities.service.js";
import { holdsRead } from "../shared/crm-read-access.js";
import { CrmTasksService } from "../tasks/tasks.service.js";

/** Mirrors the `CrmCalendar*` types in packages/api-types. */
export type CrmCalendarItemType = "meeting" | "followup" | "task" | "call";

export interface CrmCalendarEvent {
  id: string;
  recordId: number;
  itemType: CrmCalendarItemType;
  date: string;
  hasTime: boolean;
  title: string;
  subtitle: string;
  relatedType: string;
  relatedId: number;
  accountId: number | null;
  time: string | null;
  assignedTo: string | null;
  status: string | null;
  extra: string | null;
}

export interface CrmCalendarEventDetail {
  itemType: CrmCalendarItemType;
  record: Record<string, unknown>;
  title: string;
  status: string | null;
  date: string;
  hasTime: boolean;
  account: { id: number; name: string } | null;
  opportunity: { id: number; title: string; accountId: number } | null;
}

/** Upper bound per source; the calendar is a window, not an export. */
const FEED_LIMIT = 500;

const ITEM_TYPES: readonly CrmCalendarItemType[] = [
  "meeting",
  "followup",
  "task",
  "call",
];

/** Read permission each source needs (all org-wide codes). */
function readPermission(t: CrmCalendarItemType): string {
  switch (t) {
    case "meeting":
      return "crm.meeting.read";
    case "followup":
      return "crm.followup.read";
    case "task":
      return "crm.task.read";
    case "call":
      return "crm.activity.read";
  }
}

function isItemType(value: string): value is CrmCalendarItemType {
  return (ITEM_TYPES as readonly string[]).includes(value);
}

function startOfDayUtc(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** `to` is inclusive of the whole day, so the exclusive bound is the next
 * midnight. */
function endExclusiveUtc(day: string): Date {
  const d = startOfDayUtc(day);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function parseRange(from?: string, to?: string) {
  const dateFrom = from ? startOfDayUtc(from) : undefined;
  const dateTo = to ? endExclusiveUtc(to) : undefined;
  if (
    (dateFrom && Number.isNaN(dateFrom.getTime())) ||
    (dateTo && Number.isNaN(dateTo.getTime()))
  ) {
    throw new BusinessRuleViolationException(
      "from/to must be valid calendar dates",
      "INVALID_DATE_RANGE",
    );
  }
  if (dateFrom && dateTo && dateFrom >= dateTo) {
    throw new BusinessRuleViolationException(
      "from must not be after to",
      "INVALID_DATE_RANGE",
    );
  }
  return { dateFrom, dateTo };
}

/** Read-only CRM calendar (legacy `intelligence/CrmCalendar.tsx`). Like the
 * global search it never reads a table itself: each source comes from its
 * owning module's exported service, and a source is only aggregated when the
 * caller holds that entity's read permission. */
@Injectable()
export class CrmCalendarService {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly tenantContext: TenantContextService,
    private readonly accounts: AccountsService,
    private readonly meetings: MeetingsService,
    private readonly followUps: FollowUpsService,
    private readonly tasks: CrmTasksService,
    private readonly activities: ActivitiesService,
    private readonly opportunities: OpportunitiesService,
  ) {}

  private granted() {
    return this.permissions.getPermissionsForUser(
      this.tenantContext.getUserId(),
    );
  }

  async events(from?: string, to?: string) {
    const range = parseRange(from, to);
    const granted = await this.granted();
    const includedTypes = ITEM_TYPES.filter((t) =>
      holdsRead(granted, readPermission(t)),
    );
    const canAccount = holdsRead(granted, "crm.account.read");
    const has = (t: CrmCalendarItemType) => includedTypes.includes(t);

    const [meetings, followUps, tasks, calls] = await Promise.all([
      has("meeting")
        ? this.meetings.findFeed(
            { ...range, statusNotIn: ["CANCELLED", "COMPLETED"] },
            FEED_LIMIT,
          )
        : [],
      has("followup")
        ? this.followUps.findFeed(
            { ...range, statusNotIn: ["COMPLETED", "CANCELLED"] },
            FEED_LIMIT,
          )
        : [],
      has("task")
        ? this.tasks.findFeed(
            { ...range, statusNotIn: ["Completed"] },
            FEED_LIMIT,
          )
        : [],
      has("call")
        ? this.activities.findFeed({ ...range, type: "Call" }, FEED_LIMIT)
        : [],
    ]);

    const accountIds = new Set<number>();
    for (const r of [...meetings, ...followUps, ...tasks, ...calls])
      if (r.relatedType === "account") accountIds.add(r.relatedId);
    const names = canAccount
      ? await this.accounts.namesByIds([...accountIds])
      : new Map<number, string>();
    const subtitleOf = (relatedType: string, relatedId: number) =>
      relatedType === "account"
        ? (names.get(relatedId) ?? "Unknown Account")
        : "Unknown Account";
    const accountIdOf = (relatedType: string, relatedId: number) =>
      relatedType === "account" ? relatedId : null;

    const events: CrmCalendarEvent[] = [];
    for (const m of meetings) {
      events.push({
        id: `meeting_${m.id}`,
        recordId: m.id,
        itemType: "meeting",
        date: m.meetingDate.toISOString(),
        hasTime: false,
        // Legacy: Demo-mode meetings read as their own category.
        title: m.mode === "Demo" ? "Demo" : `${m.mode} Meeting`,
        subtitle: subtitleOf(m.relatedType, m.relatedId),
        relatedType: m.relatedType,
        relatedId: m.relatedId,
        accountId: accountIdOf(m.relatedType, m.relatedId),
        time: m.startTime,
        assignedTo: null,
        status: m.status.replace(/_/g, " "),
        extra: m.participants,
      });
    }
    for (const f of followUps) {
      events.push({
        id: `followup_${f.id}`,
        recordId: f.id,
        itemType: "followup",
        date: f.scheduledAt.toISOString(),
        hasTime: true,
        title: `${f.type} Follow-up`,
        subtitle: subtitleOf(f.relatedType, f.relatedId),
        relatedType: f.relatedType,
        relatedId: f.relatedId,
        accountId: accountIdOf(f.relatedType, f.relatedId),
        time: null,
        assignedTo: f.assignedTo,
        status: f.effectiveStatus,
        extra: null,
      });
    }
    for (const t of tasks) {
      events.push({
        id: `task_${t.id}`,
        recordId: t.id,
        itemType: "task",
        date: t.dueDate.toISOString(),
        hasTime: false,
        title: `Task — ${t.title}`,
        subtitle: subtitleOf(t.relatedType, t.relatedId),
        relatedType: t.relatedType,
        relatedId: t.relatedId,
        accountId: accountIdOf(t.relatedType, t.relatedId),
        time: null,
        assignedTo: t.assignedTo,
        status: t.status,
        extra: null,
      });
    }
    for (const a of calls) {
      events.push({
        id: `call_${a.id}`,
        recordId: a.id,
        itemType: "call",
        date: a.occurredAt.toISOString(),
        hasTime: true,
        title: `Call — ${a.subject}`,
        subtitle: subtitleOf(a.relatedType, a.relatedId),
        relatedType: a.relatedType,
        relatedId: a.relatedId,
        accountId: accountIdOf(a.relatedType, a.relatedId),
        time: null,
        assignedTo: null,
        status: null,
        extra: null,
      });
    }
    events.sort(
      (x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id),
    );
    return { events, includedTypes };
  }

  async eventDetail(type: string, id: number): Promise<CrmCalendarEventDetail> {
    if (!isItemType(type)) {
      throw new ResourceNotFoundException("CalendarEvent", `${type}/${id}`);
    }
    const granted = await this.granted();
    if (!holdsRead(granted, readPermission(type))) {
      throw new ForbiddenException(
        `Missing permission: ${readPermission(type)}`,
      );
    }

    let record: Record<string, unknown>;
    let relatedType: string;
    let relatedId: number;
    let title: string;
    let status: string | null;
    let date: Date;
    let hasTime: boolean;
    switch (type) {
      case "meeting": {
        const m = await this.meetings.findOne(id);
        record = m;
        ({ relatedType, relatedId } = m);
        title = m.mode === "Demo" ? "Demo" : `${m.mode} Meeting`;
        status = m.status.replace(/_/g, " ");
        date = m.meetingDate;
        hasTime = false;
        break;
      }
      case "followup": {
        const f = await this.followUps.findOne(id);
        record = f;
        ({ relatedType, relatedId } = f);
        title = `${f.type} Follow-up`;
        status = f.effectiveStatus;
        date = f.scheduledAt;
        hasTime = true;
        break;
      }
      case "task": {
        const t = await this.tasks.findOne(id);
        record = t;
        ({ relatedType, relatedId } = t);
        title = t.title;
        status = t.status;
        date = t.dueDate;
        hasTime = false;
        break;
      }
      case "call": {
        const a = await this.activities.findOne(id);
        if (a.type !== "Call")
          throw new ResourceNotFoundException("CalendarEvent", `call/${id}`);
        record = a;
        ({ relatedType, relatedId } = a);
        title = a.subject;
        status = null;
        date = a.occurredAt;
        hasTime = true;
        break;
      }
    }

    let account: CrmCalendarEventDetail["account"] = null;
    let opportunity: CrmCalendarEventDetail["opportunity"] = null;
    if (relatedType === "account" && holdsRead(granted, "crm.account.read")) {
      const names = await this.accounts.namesByIds([relatedId]);
      const name = names.get(relatedId);
      if (name) account = { id: relatedId, name };
    } else if (
      relatedType === "opportunity" &&
      holdsRead(granted, "crm.opportunity.read", true)
    ) {
      // The opportunities service applies the caller's own/team/all scope.
      try {
        const o = await this.opportunities.findOne(relatedId);
        opportunity = { id: o.id, title: o.title, accountId: o.accountId };
        if (holdsRead(granted, "crm.account.read")) {
          account = { id: o.account.id, name: o.account.name };
        }
      } catch (err) {
        if (!(err instanceof ResourceNotFoundException)) throw err;
      }
    }

    return {
      itemType: type,
      record,
      title,
      status,
      date: date.toISOString(),
      hasTime,
      account,
      opportunity,
    };
  }
}
