import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  buildCandidates,
  dayIndex,
  reconcile,
  type NotificationCandidate,
} from "./crm-notification-rules.js";
import {
  CrmNotificationsRepository,
  type ExistingRow,
} from "./crm-notifications.repository.js";
import type {
  QueryCrmNotificationsDto,
  SnoozeCrmNotificationDto,
} from "./dto/crm-notification.dto.js";

const MAX_SNOOZE_MS = 90 * 86_400_000;

const identity = (r: { sourceType: string; sourceId: number; type: string }) =>
  `${r.sourceType}:${r.sourceId}:${r.type}`;

@Injectable()
export class CrmNotificationsService {
  constructor(
    private readonly repository: CrmNotificationsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Scans the CRM sources and idempotently syncs the org's notification feed
   * (legacy `useCrmNotificationGenerator` + `useCrmDomainNotificationGenerator`,
   * run on demand instead of in each browser). Safe to call repeatedly and
   * concurrently.
   */
  async refresh(now: Date = new Date()) {
    const scope = this.tenantContext.getOrgScope();
    const data = await this.repository.scanSources(scope, now);
    const candidates = buildCandidates(data);
    const existing = await this.repository.findExisting(scope, candidates);

    const byIdentity = new Map<string, ExistingRow[]>();
    for (const row of existing) {
      const list = byIdentity.get(identity(row)) ?? [];
      list.push(row);
      byIdentity.set(identity(row), list);
    }

    const toCreate: NotificationCandidate[] = [];
    let updated = 0;
    for (const c of candidates) {
      const rows = byIdentity.get(identity(c));
      if (!rows || rows.length === 0) {
        toCreate.push(c);
        continue;
      }
      // Prefer the row for this exact due day; otherwise the most recent one
      // (a due-date edit resets it in place - legacy sourceDueRaw branch).
      const row =
        rows.find((r) => dayIndex(r.dueDate) === dayIndex(c.dueDate)) ??
        rows[rows.length - 1]!;
      const result = reconcile(row, c, now);
      if (!result) continue;
      await this.repository.applyUpdate(scope, row.id, result.data);
      updated += 1;
    }
    const created = await this.repository.createMany(scope, toCreate);
    return { created, updated, candidates: candidates.length };
  }

  async findAll(query: QueryCrmNotificationsDto) {
    const scope = this.tenantContext.getOrgScope();
    const [items, counts] = await Promise.all([
      this.repository.findMany(scope, query.tab ?? "active"),
      this.repository.counts(scope),
    ]);
    return { items, counts };
  }

  private async mustFind<T>(id: number, row: T | null): Promise<T> {
    if (!row) throw new ResourceNotFoundException("CrmNotification", id);
    return row;
  }

  async acknowledge(id: number) {
    const row = await this.repository.transition(
      this.tenantContext.getOrgScope(),
      id,
      { status: "Acknowledged", acknowledgedAt: new Date() },
      ["Pending", "Overdue", "Snoozed", "Acknowledged"],
    );
    return this.mustFind(id, row);
  }

  async markDone(id: number) {
    const row = await this.repository.transition(
      this.tenantContext.getOrgScope(),
      id,
      { status: "Done", completedAt: new Date(), snoozeUntil: null },
    );
    return this.mustFind(id, row);
  }

  async snooze(id: number, dto: SnoozeCrmNotificationDto) {
    const until = new Date(dto.until);
    const now = Date.now();
    if (until.getTime() <= now) {
      throw new BusinessRuleViolationException(
        "Snooze time must be in the future",
        "INVALID_SNOOZE",
      );
    }
    if (until.getTime() - now > MAX_SNOOZE_MS) {
      throw new BusinessRuleViolationException(
        "Snooze time can be at most 90 days ahead",
        "INVALID_SNOOZE",
      );
    }
    const row = await this.repository.transition(
      this.tenantContext.getOrgScope(),
      id,
      { status: "Snoozed", snoozeUntil: until },
      ["Pending", "Overdue", "Snoozed", "Acknowledged"],
    );
    return this.mustFind(id, row);
  }

  async markRead(id: number) {
    const row = await this.repository.transition(
      this.tenantContext.getOrgScope(),
      id,
      { isRead: true },
    );
    return this.mustFind(id, row);
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) {
      throw new BusinessRuleViolationException(
        "Only a completed notification can be moved to the Recycle Bin",
        "NOT_DELETABLE",
      );
    }
    return row;
  }

  async restore(id: number) {
    const row = await this.repository.restore(
      this.tenantContext.getOrgScope(),
      id,
    );
    return this.mustFind(id, row);
  }

  async purge(id: number) {
    const row = await this.repository.purge(
      this.tenantContext.getOrgScope(),
      id,
    );
    await this.mustFind(id, row);
  }
}
