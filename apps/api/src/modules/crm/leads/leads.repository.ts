import { classifyDbError } from "../../../common/database/db-errors.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
} from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { attachActorNames, userNamesByIds } from "../shared/actor-names.js";
import { defaultBoardStage } from "../pipeline-stages/seed.js";
import { appendStageHistory } from "../opportunities/opportunities.repository.js";
import type {
  ConvertLeadDto,
  CreateLeadDto,
  UpdateLeadDto,
} from "./dto/lead.dto.js";

const ENTITY_TYPE = "crm_lead";

/** Lead owns its own `teamId`/`createdBy` directly, same shape as Contact
 * — `teamWhere()` defaults `ownerField` to `userId`, which this table
 * doesn't have. */
const SCOPE_FIELDS = { ownerField: "createdBy" };
const INCLUDE = {
  linkedAccount: { select: { id: true, name: true } },
  linkedContact: { select: { id: true, name: true } },
  linkedOpportunity: {
    select: { id: true, title: true, opportunityNumber: true },
  },
} satisfies Prisma.LeadInclude;
type LeadRow = Prisma.LeadGetPayload<{ include: typeof INCLUDE }>;

export interface LeadFilter {
  q?: string | undefined;
  leadStatus?: string | undefined;
  assignedTo?: string | undefined;
  leadSource?: string | undefined;
  industry?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  converted?: "CONVERTED" | "NOT_CONVERTED" | undefined;
  sortBy?: "createdAt" | "companyName" | undefined;
  rating?: string | undefined;
  touched?: "TOUCHED" | "UNTOUCHED" | undefined;
  createdBy?: number | undefined;
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
  minAnnualRevenue?: number | undefined;
}

/** Roll-up fields added to every lead row: `touched` = any non-create audit
 * entry, activity, meeting or follow-up on the lead (legacy `touchedIds`);
 * `lastActivityAt` = the newest of those (legacy `lastActivityById`). */
export interface LeadRollup {
  touched: boolean;
  lastActivityAt: Date | null;
}

function snapshot(
  row: Pick<
    LeadRow,
    | "companyName"
    | "prospectName"
    | "leadStatus"
    | "priority"
    | "assignedTo"
    | "leadSource"
    | "linkedAccountId"
    | "linkedContactId"
    | "linkedOpportunityId"
    | "isActive"
    | "rating"
  >,
) {
  return {
    companyName: row.companyName,
    prospectName: row.prospectName,
    leadStatus: row.leadStatus,
    priority: row.priority,
    assignedTo: row.assignedTo,
    leadSource: row.leadSource,
    linkedAccountId: row.linkedAccountId,
    linkedContactId: row.linkedContactId,
    linkedOpportunityId: row.linkedOpportunityId,
    isActive: row.isActive,
    rating: row.rating,
  };
}

/** Search across company/prospect/email/phone, mirroring the legacy
 * Leads.tsx search box (case-insensitive substring). */
function filterWhere(filter: LeadFilter): Prisma.LeadWhereInput {
  const clauses: Prisma.LeadWhereInput[] = [{ deletedAt: null }];
  if (filter.leadStatus) clauses.push({ leadStatus: filter.leadStatus });
  if (filter.assignedTo) clauses.push({ assignedTo: filter.assignedTo });
  if (filter.leadSource) clauses.push({ leadSource: filter.leadSource });
  if (filter.industry) clauses.push({ industry: filter.industry });
  if (filter.city) clauses.push({ city: filter.city });
  if (filter.country) clauses.push({ country: filter.country });
  if (filter.rating) clauses.push({ rating: filter.rating });
  if (filter.createdBy) clauses.push({ createdBy: filter.createdBy });
  if (filter.createdFrom)
    clauses.push({ createdAt: { gte: new Date(filter.createdFrom) } });
  if (filter.createdTo) {
    const end = new Date(filter.createdTo);
    end.setUTCHours(23, 59, 59, 999);
    clauses.push({ createdAt: { lte: end } });
  }
  if (filter.converted === "CONVERTED")
    clauses.push({ linkedAccountId: { not: null } });
  if (filter.converted === "NOT_CONVERTED")
    clauses.push({ linkedAccountId: null });
  if (filter.q) {
    clauses.push({
      OR: [
        { companyName: { contains: filter.q, mode: "insensitive" } },
        { prospectName: { contains: filter.q, mode: "insensitive" } },
        { email: { contains: filter.q, mode: "insensitive" } },
        { contactNumber: { contains: filter.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: clauses };
}

@Injectable()
export class LeadsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: LeadFilter,
    pagination: PaginationDto,
  ) {
    const base = filterWhere(filter);
    const extra: Prisma.LeadWhereInput[] = [];
    if (filter.touched) {
      const touched = await this.touchedLeadIds(scope.organizationId);
      extra.push(
        filter.touched === "TOUCHED"
          ? { id: { in: touched } }
          : { id: { notIn: touched } },
      );
    }
    if (filter.minAnnualRevenue !== undefined) {
      const ids = await this.leadIdsWithMinRevenue(
        scope.organizationId,
        filter.minAnnualRevenue,
      );
      extra.push({ id: { in: ids } });
    }
    const where = teamWhere(
      scope,
      extra.length ? { AND: [base, ...extra] } : base,
      SCOPE_FIELDS,
    );
    const [rawItems, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy:
          filter.sortBy === "companyName"
            ? [{ companyName: pagination.order ?? "asc" }, { id: "asc" }]
            : [{ createdAt: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.lead.count({ where }),
    ]);
    const items = await this.decorate(scope.organizationId, rawItems);
    return { items, total };
  }

  /** Lead ids with any non-create audit entry, activity, meeting or
   * follow-up (legacy `touchedIds`). */
  private async touchedLeadIds(organizationId: number): Promise<number[]> {
    const [audit, acts, meets, fups] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          organizationId,
          entityType: ENTITY_TYPE,
          action: { not: "create" },
        },
        select: { entityId: true },
        distinct: ["entityId"],
      }),
      this.prisma.crmActivity.findMany({
        where: { organizationId, relatedType: "lead", deletedAt: null },
        select: { relatedId: true },
        distinct: ["relatedId"],
      }),
      this.prisma.crmMeeting.findMany({
        where: { organizationId, relatedType: "lead", deletedAt: null },
        select: { relatedId: true },
        distinct: ["relatedId"],
      }),
      this.prisma.crmFollowUp.findMany({
        where: { organizationId, relatedType: "lead", deletedAt: null },
        select: { relatedId: true },
        distinct: ["relatedId"],
      }),
    ]);
    return [
      ...new Set([
        ...audit.map((a) => Number(a.entityId)),
        ...acts.map((a) => a.relatedId),
        ...meets.map((a) => a.relatedId),
        ...fups.map((a) => a.relatedId),
      ]),
    ];
  }

  /** annualRevenue is free text ("$1,200,000"): keep digits/dot, compare
   * numerically, ignore values that don't parse (legacy behaviour). */
  private async leadIdsWithMinRevenue(
    organizationId: number,
    min: number,
  ): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT id FROM crm.leads
      WHERE organization_id = ${organizationId} AND deleted_at IS NULL
        AND regexp_replace(coalesce(annual_revenue, ''), '[^0-9.]', '', 'g') ~ '^[0-9]+(\\.[0-9]+)?$'
        AND regexp_replace(annual_revenue, '[^0-9.]', '', 'g')::numeric >= ${min}`);
    return rows.map((r) => r.id);
  }

  private async rollups(
    organizationId: number,
    ids: number[],
  ): Promise<Map<number, LeadRollup>> {
    const out = new Map<number, LeadRollup>();
    if (ids.length === 0) return out;
    const bump = (id: number, at: Date | null | undefined, touch: boolean) => {
      const cur = out.get(id) ?? { touched: false, lastActivityAt: null };
      if (touch) cur.touched = true;
      if (at && (!cur.lastActivityAt || at > cur.lastActivityAt))
        cur.lastActivityAt = at;
      out.set(id, cur);
    };
    const relatedWhere = {
      organizationId,
      relatedType: "lead",
      relatedId: { in: ids },
      deletedAt: null,
    };
    const [audit, acts, meets, fups] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ["entityId", "action"],
        where: {
          organizationId,
          entityType: ENTITY_TYPE,
          entityId: { in: ids.map((i) => BigInt(i)) },
        },
        _max: { at: true },
      }),
      this.prisma.crmActivity.groupBy({
        by: ["relatedId"],
        where: relatedWhere,
        _max: { occurredAt: true },
      }),
      this.prisma.crmMeeting.groupBy({
        by: ["relatedId"],
        where: relatedWhere,
        _max: { createdAt: true },
      }),
      this.prisma.crmFollowUp.groupBy({
        by: ["relatedId"],
        where: relatedWhere,
        _max: { createdAt: true },
      }),
    ]);
    audit.forEach((a) =>
      bump(Number(a.entityId), a._max.at, a.action !== "create"),
    );
    acts.forEach((a) => bump(a.relatedId, a._max.occurredAt, true));
    meets.forEach((a) => bump(a.relatedId, a._max.createdAt, true));
    fups.forEach((a) => bump(a.relatedId, a._max.createdAt, true));
    return out;
  }

  private async decorate<
    T extends {
      id: number;
      createdBy: number | null;
      updatedBy: number | null;
    },
  >(organizationId: number, rows: T[]) {
    const [named, rollups] = await Promise.all([
      attachActorNames(this.prisma, organizationId, rows),
      this.rollups(
        organizationId,
        rows.map((r) => r.id),
      ),
    ]);
    return named.map((r) => ({
      ...r,
      touched: rollups.get(r.id)?.touched ?? false,
      lastActivityAt: rollups.get(r.id)?.lastActivityAt ?? null,
    }));
  }

  /** Distinct values for the list filter dropdowns (legacy derived them
   * from the full in-memory row set). */
  @TeamScoped()
  async facets(scope: TeamScope) {
    const where = teamWhere(scope, { deletedAt: null }, SCOPE_FIELDS);
    const distinct = async (
      field: "assignedTo" | "leadSource" | "industry" | "city" | "country",
    ) => {
      const rows = await this.prisma.lead.findMany({
        where: { AND: [where, { [field]: { not: null } }] },
        select: { [field]: true },
        distinct: [field],
        orderBy: { [field]: "asc" },
      });
      return rows
        .map((r) => String((r as Record<string, unknown>)[field] ?? "").trim())
        .filter((v) => v.length > 0);
    };
    const [owners, sources, industries, cities, countries] = await Promise.all([
      distinct("assignedTo"),
      distinct("leadSource"),
      distinct("industry"),
      distinct("city"),
      distinct("country"),
    ]);
    const creators = await this.prisma.lead.findMany({
      where: { AND: [where, { createdBy: { not: null } }] },
      select: { createdBy: true },
      distinct: ["createdBy"],
    });
    const names = await userNamesByIds(
      this.prisma,
      scope.organizationId,
      creators.map((c) => c.createdBy),
    );
    const createdBy = creators
      .map((c) => ({
        id: c.createdBy as number,
        name: names.get(c.createdBy as number) ?? `User #${c.createdBy}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { owners, sources, industries, cities, countries, createdBy };
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    const row = await this.prisma.lead.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
      include: INCLUDE,
    });
    if (!row) return null;
    const [decorated] = await this.decorate(scope.organizationId, [row]);
    return decorated ?? null;
  }

  @TeamScoped()
  async create(scope: TeamScope, dto: CreateLeadDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          organizationId: scope.organizationId,
          teamId: scope.level === "team" ? (scope.teamIds[0] ?? null) : null,
          companyName: dto.companyName,
          prospectName: dto.prospectName,
          domain: dto.domain ?? null,
          hq: dto.hq ?? null,
          industry: dto.industry ?? null,
          annualRevenue: dto.annualRevenue ?? null,
          numberOfEmployees: dto.numberOfEmployees ?? null,
          title: dto.title ?? null,
          contactNumber: dto.contactNumber ?? null,
          mobile: dto.mobile ?? null,
          email: dto.email ?? null,
          fax: dto.fax ?? null,
          skypeId: dto.skypeId ?? null,
          meetingStatus: dto.meetingStatus ?? null,
          meetingScheduled: dto.meetingScheduled ?? null,
          meetingDate: dto.meetingDate ? new Date(dto.meetingDate) : null,
          leadStatus: dto.leadStatus ?? "NEW",
          priority: dto.priority ?? null,
          rating: dto.rating ?? null,
          month: dto.month ?? null,
          customFields: dto.customFields ?? Prisma.JsonNull,
          assignedTo: dto.assignedTo ?? null,
          leadSource: dto.leadSource ?? null,
          emailOptOut: dto.emailOptOut ?? false,
          dataProcessingBasis: dto.dataProcessingBasis ?? null,
          addressStreet: dto.addressStreet ?? null,
          city: dto.city ?? null,
          state: dto.state ?? null,
          postalCode: dto.postalCode ?? null,
          country: dto.country ?? null,
          tags: dto.tags ?? null,
          areaOfInterest: dto.areaOfInterest ?? null,
          comments: dto.comments ?? null,
          createdBy: actorId,
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return created;
    });
  }

  @TeamScoped()
  async update(
    scope: TeamScope,
    id: number,
    dto: UpdateLeadDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.lead.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      const field = (
        value: string | undefined,
        current: string | null,
      ): string | null => (value === undefined ? current : value || null);
      const after = await tx.lead.update({
        where: { id },
        data: {
          companyName: dto.companyName ?? before.companyName,
          prospectName: dto.prospectName ?? before.prospectName,
          domain: field(dto.domain, before.domain),
          hq: field(dto.hq, before.hq),
          industry: field(dto.industry, before.industry),
          annualRevenue: field(dto.annualRevenue, before.annualRevenue),
          numberOfEmployees: field(
            dto.numberOfEmployees,
            before.numberOfEmployees,
          ),
          title: field(dto.title, before.title),
          contactNumber: field(dto.contactNumber, before.contactNumber),
          mobile: field(dto.mobile, before.mobile),
          email: field(dto.email, before.email),
          fax: field(dto.fax, before.fax),
          skypeId: field(dto.skypeId, before.skypeId),
          meetingStatus: field(dto.meetingStatus, before.meetingStatus),
          meetingScheduled: field(
            dto.meetingScheduled,
            before.meetingScheduled,
          ),
          meetingDate:
            dto.meetingDate === undefined
              ? before.meetingDate
              : dto.meetingDate
                ? new Date(dto.meetingDate)
                : null,
          leadStatus: dto.leadStatus ?? before.leadStatus,
          priority: field(dto.priority, before.priority),
          rating: field(dto.rating, before.rating),
          month: field(dto.month, before.month),
          ...(dto.customFields !== undefined
            ? { customFields: dto.customFields }
            : {}),
          assignedTo: field(dto.assignedTo, before.assignedTo),
          leadSource: field(dto.leadSource, before.leadSource),
          emailOptOut: dto.emailOptOut ?? before.emailOptOut,
          dataProcessingBasis: field(
            dto.dataProcessingBasis,
            before.dataProcessingBasis,
          ),
          addressStreet: field(dto.addressStreet, before.addressStreet),
          city: field(dto.city, before.city),
          state: field(dto.state, before.state),
          postalCode: field(dto.postalCode, before.postalCode),
          country: field(dto.country, before.country),
          tags: field(dto.tags, before.tags),
          areaOfInterest: field(dto.areaOfInterest, before.areaOfInterest),
          comments: field(dto.comments, before.comments),
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /** Lead notes (legacy `crm/notes/<leadId>`). */
  @TeamScoped()
  async listNotes(scope: TeamScope, leadId: number) {
    const lead = await this.findOne(scope, leadId);
    if (!lead) return null;
    const rows = await this.prisma.crmLeadNote.findMany({
      where: { organizationId: scope.organizationId, leadId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return attachActorNames(this.prisma, scope.organizationId, rows);
  }

  @TeamScoped()
  async addNote(
    scope: TeamScope,
    leadId: number,
    content: string,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: teamWhere(scope, { id: leadId, deletedAt: null }, SCOPE_FIELDS),
        select: { id: true },
      });
      if (!lead) return null;
      const note = await tx.crmLeadNote.create({
        data: {
          organizationId: scope.organizationId,
          leadId,
          content,
          createdBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: leadId,
        action: "note_added",
        after: { noteId: note.id },
      });
      const [named] = await attachActorNames(tx, scope.organizationId, [note]);
      return named ?? null;
    });
  }

  @TeamScoped()
  async deleteNote(scope: TeamScope, leadId: number, noteId: number) {
    const lead = await this.findOne(scope, leadId);
    if (!lead) return null;
    const res = await this.prisma.crmLeadNote.updateMany({
      where: {
        id: noteId,
        leadId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    return res.count > 0;
  }

  /** Audit feed for the lead Timeline tab (legacy
   * `subscribeCrmAuditLogsForEntity`): one entry per audit row with a
   * summary of what changed. */
  @TeamScoped()
  async timeline(scope: TeamScope, leadId: number) {
    const lead = await this.findOne(scope, leadId);
    if (!lead) return null;
    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId: scope.organizationId,
        entityType: ENTITY_TYPE,
        entityId: BigInt(leadId),
      },
      orderBy: { id: "desc" },
      take: 200,
      include: { actor: { select: { fullName: true } } },
    });
    return logs.map((l) => {
      const before = (l.before ?? {}) as Record<string, unknown>;
      const after = (l.after ?? {}) as Record<string, unknown>;
      const changes =
        l.action === "update"
          ? Object.keys(after)
              .filter(
                (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
              )
              .map((k) => ({
                field: k,
                from: before[k] == null ? null : String(before[k]),
                to: after[k] == null ? null : String(after[k]),
              }))
          : [];
      return {
        id: Number(l.id),
        action: l.action,
        at: l.at,
        by: l.actor?.fullName ?? null,
        changes,
      };
    });
  }

  /** Soft-delete only — never a hard delete (Docs/ARCHITECTURE.md §5). Gated
   * at the controller by `crm.lead.write` — legacy gates it behind "CRM
   * Admin only"; see the catalog.ts note on crm.lead.write. */
  @TeamScoped()
  async softDelete(scope: TeamScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.lead.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
        include: INCLUDE,
      });
      if (!before) return null;
      const after = await tx.lead.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  }

  /**
   * Reproduces legacy `domain/LeadConvertDialog.tsx` minus Deal/Opportunity
   * creation (no production entity yet — see dto/lead.dto.ts). One
   * transaction: optionally creates an Account, optionally creates a
   * Contact under it, then links both onto the Lead and flips
   * `leadStatus` to CONVERTED. Throws `ALREADY_CONVERTED` if the lead is
   * already linked to an Account (legacy's dialog is a one-shot flow); a
   * caller who wants to re-run a failed conversion must use a fresh lead.
   */
  @TeamScoped()
  async convert(
    scope: TeamScope,
    id: number,
    dto: ConvertLeadDto,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
      });
      if (!lead) return null;
      if (lead.linkedAccountId) {
        throw new BusinessRuleViolationException(
          `Lead ${id} was already converted`,
          "ALREADY_CONVERTED",
        );
      }

      let accountId: number;
      if (dto.accountMode === "existing") {
        if (!dto.existingAccountId) {
          throw new BusinessRuleViolationException(
            "existingAccountId is required when accountMode is 'existing'",
            "MISSING_EXISTING_ACCOUNT",
          );
        }
        const existing = await tx.account.findFirst({
          where: {
            id: dto.existingAccountId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!existing) {
          throw new BusinessRuleViolationException(
            `Account ${dto.existingAccountId} does not exist in this organization`,
            "INVALID_ACCOUNT",
          );
        }
        accountId = existing.id;
      } else {
        if (!dto.confirmDuplicate) {
          const duplicate = await tx.account.findFirst({
            where: {
              organizationId: scope.organizationId,
              deletedAt: null,
              name: { equals: lead.companyName, mode: "insensitive" },
            },
            select: { id: true, name: true },
          });
          if (duplicate) {
            throw new BusinessRuleViolationException(
              `An account named "${duplicate.name}" may already exist — resubmit with confirmDuplicate: true to create a new one anyway`,
              "DUPLICATE_ACCOUNT",
            );
          }
        }
        const createdAccount = await tx.account.create({
          data: {
            organizationId: scope.organizationId,
            name: lead.companyName,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        await this.audit.write(tx, {
          entityType: "crm_account",
          entityId: createdAccount.id,
          action: "create",
          after: {
            name: createdAccount.name,
            isActive: createdAccount.isActive,
          },
        });
        accountId = createdAccount.id;
      }

      let contactId: number | undefined;
      const contactName = dto.contactName?.trim() || lead.prospectName;
      if (contactName) {
        const createdContact = await tx.contact.create({
          data: {
            organizationId: scope.organizationId,
            accountId,
            name: contactName,
            designation: dto.contactTitle || lead.title || null,
            email: dto.contactEmail || lead.email || null,
            phone: dto.contactPhone || lead.contactNumber || null,
            isPrimary: true,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        await this.audit.write(tx, {
          entityType: "crm_contact",
          entityId: createdContact.id,
          action: "create",
          after: {
            accountId,
            name: createdContact.name,
            isActive: createdContact.isActive,
          },
        });
        contactId = createdContact.id;
      }

      let opportunityId: number | undefined;
      if (dto.createDeal) {
        const stage = dto.dealStageId
          ? await tx.pipelineStage.findFirst({
              where: {
                id: dto.dealStageId,
                organizationId: scope.organizationId,
                deletedAt: null,
              },
            })
          : await defaultBoardStage(tx, scope.organizationId, actorId);
        if (!stage) {
          throw new BusinessRuleViolationException(
            dto.dealStageId
              ? `Stage ${dto.dealStageId} does not exist in this organization`
              : "This organization has no pipeline stage to create a deal into",
            "INVALID_STAGE",
          );
        }
        const createdOpportunity = await tx.opportunity.create({
          data: {
            organizationId: scope.organizationId,
            accountId,
            contactId: contactId ?? null,
            leadId: id,
            title: dto.dealTitle || `${lead.companyName} — Opportunity`,
            ownerName: lead.assignedTo || "CRM User",
            stageId: stage.id,
            estimatedValue: dto.dealAmount ?? 0,
            expectedCloseDate: dto.dealCloseDate
              ? new Date(dto.dealCloseDate)
              : null,
            campaignSource: dto.campaignSource ?? null,
            contactRole: dto.contactRole ?? null,
            priority: lead.priority ?? "Medium",
            opportunityNumber: "PENDING",
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        const numberedOpportunity = await tx.opportunity.update({
          where: { id: createdOpportunity.id },
          data: {
            opportunityNumber: `OPP-${String(createdOpportunity.id).padStart(6, "0")}`,
          },
        });
        await appendStageHistory(
          tx,
          scope.organizationId,
          numberedOpportunity.id,
          null,
          stage.id,
          actorId,
          "Opportunity created",
        );
        await this.audit.write(tx, {
          entityType: "crm_opportunity",
          entityId: numberedOpportunity.id,
          action: "create",
          after: {
            title: numberedOpportunity.title,
            accountId,
            stageId: stage.id,
          },
        });
        opportunityId = numberedOpportunity.id;
      }

      const after = await tx.lead.update({
        where: { id },
        data: {
          linkedAccountId: accountId,
          linkedContactId: contactId ?? null,
          linkedOpportunityId: opportunityId ?? null,
          leadStatus: "CONVERTED",
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(lead),
        after: snapshot(after),
      });
      return after;
    });
  }
  /** Recycle Bin: this organization's soft-deleted rows, newest deletion first. */
  @OrgScoped()
  async findDeleted(scope: OrgScope) {
    return this.prisma.lead.findMany({
      where: tenantWhere(scope, { deletedAt: { not: null } }),
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: 2000,
    });
  }

  /** Recycle Bin restore: clears `deletedAt`. Returns null when the row is not in the bin. */
  @OrgScoped()
  async restoreDeleted(scope: OrgScope, id: number, actorId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.lead.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before || !before.deletedAt) return null;
        const after = await tx.lead.update({
          where: { id },
          data: { deletedAt: null, isActive: true, updatedBy: actorId },
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
    } catch (error) {
      if (classifyDbError(error)?.kind === "unique") {
        throw new ResourceConflictException(
          "A live record with the same unique value already exists, so this one can't be restored",
        );
      }
      throw error;
    }
  }

  /** Recycle Bin permanent delete: irreversible hard delete of a soft-deleted row. FK-safe: rows the record owns are removed, nullable references to it are cleared, and anything else still referencing it aborts with STILL_REFERENCED. Returns null when the row is not in the bin. */
  @OrgScoped()
  async purgeDeleted(scope: OrgScope, id: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.lead.findFirst({
          where: tenantWhere(scope, { id, deletedAt: { not: null } }),
        });
        if (!before) return null;
        await tx.opportunity.updateMany({
          where: { leadId: id, organizationId: scope.organizationId },
          data: { leadId: null },
        });
        await tx.lead.delete({ where: { id } });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "purge",
          before: { deletedAt: before.deletedAt },
        });
        return before;
      });
    } catch (error) {
      if (classifyDbError(error)?.kind === "foreign_key") {
        throw new BusinessRuleViolationException(
          "This record is still referenced by other records and can't be permanently deleted",
          "STILL_REFERENCED",
        );
      }
      throw error;
    }
  }
}
