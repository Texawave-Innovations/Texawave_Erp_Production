import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  dayStart,
  type ExistingNotification,
  type NotificationCandidate,
  type NotificationSourceType,
  type RelatedRef,
  type ScanData,
} from "./crm-notification-rules.js";

const ENTITY_TYPE = "crm_notification";

export type NotificationTab = "active" | "completed" | "deleted";

export type ExistingRow = ExistingNotification & {
  sourceType: string;
  sourceId: number;
  type: string;
};

function tabWhere(tab: NotificationTab): Prisma.CrmNotificationWhereInput {
  if (tab === "deleted") return { deletedAt: { not: null } };
  if (tab === "completed") return { deletedAt: null, status: "Done" };
  return { deletedAt: null, status: { not: "Done" } };
}

@Injectable()
export class CrmNotificationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /**
   * Read-only scan of every source the generator looks at. Only rows that can
   * possibly produce a candidate are loaded (due within tomorrow, open, ...).
   */
  @OrgScoped()
  async scanSources(scope: OrgScope, now: Date): Promise<ScanData> {
    const org = scope.organizationId;
    const tomorrowEnd = new Date(dayStart(now).getTime() + 2 * 86_400_000);
    const sentBefore = new Date(now.getTime() - 3 * 86_400_000);

    const [meetings, followUps, tasks, opportunities, quotations, accounts] =
      await Promise.all([
        this.prisma.crmMeeting.findMany({
          where: {
            organizationId: org,
            deletedAt: null,
            status: { notIn: ["CANCELLED", "COMPLETED"] },
            OR: [
              { status: "RESCHEDULED" },
              { meetingDate: { lt: tomorrowEnd } },
            ],
          },
          select: {
            id: true,
            relatedType: true,
            relatedId: true,
            mode: true,
            meetingDate: true,
            startTime: true,
            status: true,
          },
        }),
        this.prisma.crmFollowUp.findMany({
          where: {
            organizationId: org,
            deletedAt: null,
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            scheduledAt: { lt: tomorrowEnd },
          },
          select: {
            id: true,
            relatedType: true,
            relatedId: true,
            type: true,
            scheduledAt: true,
            assignedTo: true,
            status: true,
          },
        }),
        this.prisma.crmTask.findMany({
          where: {
            organizationId: org,
            deletedAt: null,
            status: "Open",
            dueDate: { lt: tomorrowEnd },
          },
          select: {
            id: true,
            relatedType: true,
            relatedId: true,
            title: true,
            dueDate: true,
            assignedTo: true,
            status: true,
          },
        }),
        this.prisma.opportunity.findMany({
          where: { organizationId: org, deletedAt: null, status: "OPEN" },
          select: {
            id: true,
            accountId: true,
            title: true,
            status: true,
            stageEnteredAt: true,
            expectedCloseDate: true,
            stage: { select: { label: true, slaDays: true } },
          },
        }),
        this.prisma.quotation.findMany({
          where: {
            organizationId: org,
            deletedAt: null,
            status: "Sent",
            createdAt: { lte: sentBefore },
          },
          select: {
            id: true,
            accountId: true,
            quotationNumber: true,
            status: true,
            createdAt: true,
          },
        }),
        this.prisma.account.findMany({
          where: {
            organizationId: org,
            deletedAt: null,
            statusTag: { in: ["Keep in Touch", "Call Back", "Send Info"] },
            statusDate: { lt: tomorrowEnd },
          },
          select: { id: true, name: true, statusTag: true, statusDate: true },
        }),
      ]);

    // Resolve display names for polymorphic (relatedType/relatedId) sources.
    const relatedOf = (type: string) =>
      [...followUps, ...meetings, ...tasks]
        .filter((r) => r.relatedType === type)
        .map((r) => r.relatedId);
    const accountIds = new Set<number>([
      ...relatedOf("account"),
      ...opportunities.map((o) => o.accountId),
      ...quotations.map((q) => q.accountId),
    ]);
    const [contactRows, oppRows, leadRows] = await Promise.all([
      this.prisma.contact.findMany({
        where: { organizationId: org, id: { in: relatedOf("contact") } },
        select: { id: true, accountId: true },
      }),
      this.prisma.opportunity.findMany({
        where: { organizationId: org, id: { in: relatedOf("opportunity") } },
        select: { id: true, accountId: true },
      }),
      this.prisma.lead.findMany({
        where: { organizationId: org, id: { in: relatedOf("lead") } },
        select: { id: true, companyName: true, linkedAccountId: true },
      }),
    ]);
    contactRows.forEach((c) => accountIds.add(c.accountId));
    oppRows.forEach((o) => accountIds.add(o.accountId));
    leadRows.forEach(
      (l) => l.linkedAccountId && accountIds.add(l.linkedAccountId),
    );
    const names = new Map<number, string>(
      (
        await this.prisma.account.findMany({
          where: { organizationId: org, id: { in: [...accountIds] } },
          select: { id: true, name: true },
        })
      ).map((a) => [a.id, a.name]),
    );
    const accountName = (id: number) => names.get(id) ?? "Unknown Account";
    const contactAccount = new Map(contactRows.map((c) => [c.id, c.accountId]));
    const oppAccount = new Map(oppRows.map((o) => [o.id, o.accountId]));
    const leadById = new Map(leadRows.map((l) => [l.id, l]));

    const resolveRelated = (type: string, id: number): RelatedRef => {
      let accountId: number | null = null;
      if (type === "account") accountId = id;
      else if (type === "contact") accountId = contactAccount.get(id) ?? null;
      else if (type === "opportunity") accountId = oppAccount.get(id) ?? null;
      else if (type === "lead") {
        const lead = leadById.get(id);
        if (lead && !lead.linkedAccountId)
          return { companyName: lead.companyName, accountId: null };
        accountId = lead?.linkedAccountId ?? null;
      }
      return {
        companyName: accountId ? accountName(accountId) : "Unknown Account",
        accountId,
      };
    };

    return {
      now,
      meetings,
      followUps,
      tasks,
      opportunities,
      quotations,
      accounts,
      accountName,
      resolveRelated,
    };
  }

  @OrgScoped()
  async findExisting(
    scope: OrgScope,
    candidates: NotificationCandidate[],
  ): Promise<ExistingRow[]> {
    if (candidates.length === 0) return [];
    const bySource = new Map<NotificationSourceType, Set<number>>();
    for (const c of candidates) {
      const set = bySource.get(c.sourceType) ?? new Set<number>();
      set.add(c.sourceId);
      bySource.set(c.sourceType, set);
    }
    return this.prisma.crmNotification.findMany({
      where: {
        organizationId: scope.organizationId,
        OR: [...bySource.entries()].map(([sourceType, ids]) => ({
          sourceType,
          sourceId: { in: [...ids] },
        })),
      },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        type: true,
        dueDate: true,
        status: true,
        snoozeUntil: true,
        deletedAt: true,
      },
      orderBy: { id: "asc" },
    });
  }

  /** Concurrent refreshes are safe: the dedupe unique key + skipDuplicates. */
  @OrgScoped()
  async createMany(scope: OrgScope, items: NotificationCandidate[]) {
    if (items.length === 0) return 0;
    const result = await this.prisma.crmNotification.createMany({
      skipDuplicates: true,
      data: items.map((c) => ({
        organizationId: scope.organizationId,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        type: c.type,
        title: c.title,
        description: c.description,
        accountId: c.accountId,
        companyName: c.companyName,
        prospectName: c.prospectName,
        dueDate: c.dueDate,
        priority: c.priority,
        status: c.diffDays < 0 ? "Overdue" : "Pending",
      })),
    });
    return result.count;
  }

  @OrgScoped()
  async applyUpdate(
    scope: OrgScope,
    id: number,
    data: Prisma.CrmNotificationUpdateManyMutationInput,
  ) {
    const result = await this.prisma.crmNotification.updateMany({
      where: tenantWhere(scope, { id }),
      data,
    });
    return result.count;
  }

  @OrgScoped()
  async findMany(scope: OrgScope, tab: NotificationTab) {
    return this.prisma.crmNotification.findMany({
      where: tenantWhere(scope, tabWhere(tab)),
      orderBy:
        tab === "deleted"
          ? [{ deletedAt: "desc" }, { id: "desc" }]
          : [{ dueDate: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 500,
    });
  }

  @OrgScoped()
  async counts(scope: OrgScope) {
    const [active, unread, completed, deleted] = await Promise.all(
      [
        tabWhere("active"),
        { ...tabWhere("active"), isRead: false },
        tabWhere("completed"),
        tabWhere("deleted"),
      ].map((w) =>
        this.prisma.crmNotification.count({ where: tenantWhere(scope, w) }),
      ),
    );
    return { active, unread, completed, deleted };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    return this.prisma.crmNotification.findFirst({
      where: tenantWhere(scope, { id }),
    });
  }

  /** Applies a user-owned state transition to a live (not recycled) row. */
  @OrgScoped()
  async transition(
    scope: OrgScope,
    id: number,
    data: Prisma.CrmNotificationUpdateInput,
    allowedFrom: string[] | null = null,
  ) {
    const result = await this.prisma.crmNotification.updateMany({
      where: tenantWhere(scope, {
        id,
        deletedAt: null,
        ...(allowedFrom ? { status: { in: allowedFrom } } : {}),
      }),
      data,
    });
    if (result.count === 0) return null;
    return this.findOne(scope, id);
  }

  /** Legacy "delete a Completed notification" -> the notification Recycle Bin. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmNotification.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null, status: "Done" }),
      });
      if (!before) return null;
      const after = await tx.crmNotification.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: { type: before.type, status: before.status },
        after: { deletedAt: after.deletedAt },
      });
      return after;
    });
  }

  @OrgScoped()
  async restore(scope: OrgScope, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmNotification.findFirst({
        where: tenantWhere(scope, { id, deletedAt: { not: null } }),
      });
      if (!before) return null;
      const after = await tx.crmNotification.update({
        where: { id },
        data: { deletedAt: null },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "restore",
        before: { deletedAt: before.deletedAt },
        after: { deletedAt: null },
      });
      return after;
    });
  }

  /** Irreversible. Only a row already in the Recycle Bin can be purged. */
  @OrgScoped()
  async purge(scope: OrgScope, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.crmNotification.findFirst({
        where: tenantWhere(scope, { id, deletedAt: { not: null } }),
      });
      if (!before) return null;
      await tx.crmNotification.delete({ where: { id } });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "purge",
        before: { type: before.type, sourceType: before.sourceType },
      });
      return before;
    });
  }
}
