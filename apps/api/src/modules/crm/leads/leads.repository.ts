import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
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
    const where = teamWhere(scope, filterWhere(filter), SCOPE_FIELDS);
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "asc" }, { id: "asc" }],
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { items, total };
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    return this.prisma.lead.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }, SCOPE_FIELDS),
      include: INCLUDE,
    });
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
}
