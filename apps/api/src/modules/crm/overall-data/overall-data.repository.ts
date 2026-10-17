import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { OverallSources } from "./overall-data.derive.js";

type Related = { relatedType: string; relatedId: number };

/** Read-only loader for the Overall Data tracker. Pulls every source row
 * created/occurring in `[from, to)` (a generous UTC window; exact IST
 * bucketing happens in the pure derive step) and resolves the display names
 * the legacy hook joined in memory. Never writes. */
@Injectable()
export class CrmOverallDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async loadSources(
    scope: OrgScope,
    from: Date,
    to: Date,
  ): Promise<OverallSources> {
    const orgId = scope.organizationId;
    const inWindow = { gte: from, lt: to };

    const [mining, coldCalls, activities, meetings, audits] = await Promise.all(
      [
        this.prisma.crmMiningRow.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            createdAt: inWindow,
          },
        }),
        this.prisma.crmColdCallingEntry.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            createdAt: inWindow,
          },
        }),
        this.prisma.crmActivity.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            type: { in: ["Email", "Call"] },
            occurredAt: inWindow,
          },
        }),
        this.prisma.crmMeeting.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            OR: [
              { createdAt: inWindow },
              { completedAt: inWindow },
              { cancelledAt: inWindow },
            ],
          },
        }),
        this.prisma.auditLog.findMany({
          where: {
            organizationId: orgId,
            entityType: "crm_account",
            action: "status_tag_changed",
            at: inWindow,
          },
          orderBy: { id: "asc" },
        }),
      ],
    );

    // ---- name / account resolution (batched lookups) ----
    const related: Related[] = [...activities, ...meetings];
    const ids = (type: string) => [
      ...new Set(
        related.filter((r) => r.relatedType === type).map((r) => r.relatedId),
      ),
    ];
    const contactIds = ids("contact");
    const oppIds = ids("opportunity");
    const leadIds = ids("lead");
    const auditAccountIds = audits.map((a) => Number(a.entityId));
    const coldAccountIds = coldCalls
      .map((c) => c.linkedAccountId)
      .filter((v): v is number => v !== null);

    const [contacts, opps, leads] = await Promise.all([
      this.prisma.contact.findMany({
        where: { organizationId: orgId, id: { in: contactIds } },
        select: { id: true, name: true, accountId: true },
      }),
      this.prisma.opportunity.findMany({
        where: { organizationId: orgId, id: { in: oppIds } },
        select: { id: true, accountId: true },
      }),
      this.prisma.lead.findMany({
        where: { organizationId: orgId, id: { in: leadIds } },
        select: { id: true, linkedAccountId: true },
      }),
    ]);
    const contactById = new Map(contacts.map((c) => [c.id, c]));
    const oppAccount = new Map(opps.map((o) => [o.id, o.accountId]));
    const leadAccount = new Map(leads.map((l) => [l.id, l.linkedAccountId]));

    const resolveAccountId = (r: Related): number | undefined => {
      switch (r.relatedType) {
        case "account":
          return r.relatedId;
        case "contact":
          return contactById.get(r.relatedId)?.accountId;
        case "opportunity":
          return oppAccount.get(r.relatedId);
        case "lead":
          return leadAccount.get(r.relatedId) ?? undefined;
        default:
          return undefined;
      }
    };

    const accountIds = new Set<number>([
      ...auditAccountIds,
      ...coldAccountIds,
      ...related
        .map(resolveAccountId)
        .filter((v): v is number => v !== undefined),
    ]);
    const userIds = new Set<number>();
    for (const row of [...mining, ...coldCalls, ...activities, ...meetings]) {
      if (row.createdBy) userIds.add(row.createdBy);
    }
    for (const a of audits) if (a.actorUserId) userIds.add(a.actorUserId);

    const [accounts, users] = await Promise.all([
      this.prisma.account.findMany({
        where: { organizationId: orgId, id: { in: [...accountIds] } },
        select: { id: true, name: true, statusTag: true, statusDate: true },
      }),
      this.prisma.user.findMany({
        where: { organizationId: orgId, id: { in: [...userIds] } },
        select: { id: true, fullName: true },
      }),
    ]);
    const accountName = new Map(accounts.map((a) => [a.id, a.name]));
    const accountStatus = new Map(accounts.map((a) => [a.id, a]));
    const userName = new Map(users.map((u) => [u.id, u.fullName]));
    const owner = (id: number | null | undefined) =>
      (id ? userName.get(id) : undefined) ?? "—";

    return {
      mining: mining.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        owner: r.assignedTo || owner(r.createdBy),
        companyName: r.companyName,
        keyDecisionMakers: r.keyDecisionMakers,
        followUpStatus: r.followUpStatus,
        emailStatus: r.emailStatus,
        notes: r.notes,
      })),
      coldCalls: coldCalls.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        owner: owner(r.createdBy),
        linkedAccountId: r.linkedAccountId,
        accountName:
          (r.linkedAccountId
            ? accountName.get(r.linkedAccountId)
            : undefined) ?? r.companyName,
        prospectName: r.prospectName,
        status: r.status,
      })),
      activities: activities.map((a) => {
        const accountId = resolveAccountId(a);
        const contact =
          a.relatedType === "contact"
            ? contactById.get(a.relatedId)
            : undefined;
        return {
          id: a.id,
          type: a.type,
          subject: a.subject,
          direction: a.direction,
          notes: a.notes,
          occurredAt: a.occurredAt,
          owner: owner(a.createdBy),
          accountId,
          accountName: accountId ? accountName.get(accountId) : undefined,
          contactId: contact?.id,
          contactName: contact?.name,
        };
      }),
      meetings: meetings.map((m) => {
        const accountId = resolveAccountId(m);
        const contact =
          m.relatedType === "contact"
            ? contactById.get(m.relatedId)
            : undefined;
        return {
          id: m.id,
          mode: m.mode,
          status: m.status,
          meetingDate: m.meetingDate,
          startTime: m.startTime,
          agenda: m.agenda,
          summary: m.summary,
          nextStep: m.nextStep,
          createdAt: m.createdAt,
          completedAt: m.completedAt,
          cancelledAt: m.cancelledAt,
          owner: owner(m.createdBy),
          accountId,
          accountName: accountId ? accountName.get(accountId) : undefined,
          contactId: contact?.id,
          contactName: contact?.name,
        };
      }),
      statusChanges: audits.flatMap((a) => {
        const after = a.after as { statusTag?: unknown } | null;
        if (typeof after?.statusTag !== "string") return [];
        const accountId = Number(a.entityId);
        return [
          {
            id: Number(a.id),
            at: a.at,
            owner: owner(a.actorUserId),
            accountId,
            accountName: accountName.get(accountId),
            statusTag: after.statusTag,
            reason: a.reason,
            // The account's CURRENT follow-up / call-back date, only while
            // the change being shown is still its current status.
            dueDate:
              accountStatus.get(accountId)?.statusTag === after.statusTag
                ? (accountStatus
                    .get(accountId)
                    ?.statusDate?.toISOString()
                    .slice(0, 10) ?? undefined)
                : undefined,
          },
        ];
      }),
    };
  }
}
