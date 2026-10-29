import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CreateProposalTemplateDto,
  UpdateProposalTemplateDto,
} from "./dto/template.dto.js";
import type {
  CreateProposalDocumentDto,
  QueryProposalDocumentDto,
  UpdateProposalDocumentDto,
} from "./dto/document.dto.js";
import type { UpdateProposalSettingsDto } from "./dto/settings.dto.js";
import { FOLLOW_UP_CLOSED_STATUSES } from "./proposal-workflow.js";
import {
  issueProposalNumber,
  type ProposalNumberFormat,
} from "./sequences/proposal-sequences.js";

/** Project identity copied onto a proposal when it's linked (resolved by
 * the service through `ProjectsService`, never trusted from the client). */
export interface ResolvedProposalProject {
  id: number;
  code: string;
  name: string;
  clientId: number | null;
  clientName: string | null;
}

export type { ProposalNumberFormat };

/** `created` activity's author — the list's "Created By" column. */
const CREATED_BY_ACTIVITY = {
  where: { action: "created" },
  take: 1,
  select: { userName: true },
} as const;

function startOfTodayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class ProposalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  @OrgScoped()
  findTemplates(scope: OrgScope) {
    return this.prisma.proposalTemplate.findMany({
      where: tenantWhere(scope, { deletedAt: null }),
      orderBy: { createdAt: "desc" },
    });
  }

  /** Template a new proposal uses when none is picked: the active default,
   * else the most recently published current version. */
  @OrgScoped()
  findDefaultActiveTemplate(scope: OrgScope) {
    return this.prisma.proposalTemplate.findFirst({
      where: tenantWhere(scope, {
        deletedAt: null,
        status: "active" as const,
        isCurrent: true,
      }),
      orderBy: [{ isDefault: "desc" }, { publishedAt: "desc" }],
    });
  }

  @OrgScoped()
  findTemplateById(scope: OrgScope, id: number) {
    return this.prisma.proposalTemplate.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async createTemplate(
    scope: OrgScope,
    dto: CreateProposalTemplateDto,
    createdBy: number,
    createdByName: string,
  ) {
    if (dto.isDefault) {
      await this.prisma.proposalTemplate.updateMany({
        where: tenantWhere(scope, { isDefault: true }),
        data: { isDefault: false },
      });
    }
    return this.prisma.proposalTemplate.create({
      data: {
        organizationId: scope.organizationId,
        code: dto.code ?? null,
        name: dto.name,
        title: dto.title,
        description: dto.description ?? null,
        department: dto.department ?? null,
        category: dto.category ?? null,
        schemaJson: (dto.schemaJson ?? []) as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
        createdBy,
        createdByName,
      },
    });
  }

  @OrgScoped()
  async updateTemplate(
    scope: OrgScope,
    id: number,
    dto: UpdateProposalTemplateDto,
  ) {
    if (dto.isDefault) {
      await this.prisma.proposalTemplate.updateMany({
        where: tenantWhere(scope, { isDefault: true }),
        data: { isDefault: false },
      });
    }
    const { schemaJson, ...rest } = dto;
    const result = await this.prisma.proposalTemplate.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: {
        ...rest,
        ...(schemaJson !== undefined
          ? { schemaJson: schemaJson as Prisma.InputJsonValue }
          : {}),
        ...(dto.status === "active" ? { publishedAt: new Date() } : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findTemplateById(scope, id);
  }

  /** Legacy duplicate / "create new version" — a fresh draft cloned from
   * `sourceId`. A new version links back via `parentVersionId` and is not
   * `isCurrent` until it is published. */
  @OrgScoped()
  async cloneTemplate(
    scope: OrgScope,
    sourceId: number,
    overrides: {
      name: string;
      title: string;
      code: string | null;
      version: number;
      parentVersionId: number | null;
      isCurrent: boolean;
    },
    createdBy: number,
    createdByName: string,
  ) {
    const source = await this.findTemplateById(scope, sourceId);
    if (!source) return null;
    return this.prisma.proposalTemplate.create({
      data: {
        organizationId: scope.organizationId,
        code: overrides.code,
        name: overrides.name,
        title: overrides.title,
        description: source.description,
        department: source.department,
        category: source.category,
        version: overrides.version,
        parentVersionId: overrides.parentVersionId,
        isCurrent: overrides.isCurrent,
        status: "draft",
        isDefault: false,
        schemaJson: source.schemaJson as Prisma.InputJsonValue,
        createdBy,
        createdByName,
      },
    });
  }

  /** Draft -> active. Publishing a newer version retires the version it was
   * created from (`isCurrent=false`) and hands over the default flag. */
  @OrgScoped()
  async publishTemplate(scope: OrgScope, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.proposalTemplate.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
      });
      if (!template) return null;
      let inheritDefault = false;
      if (template.parentVersionId) {
        const parent = await tx.proposalTemplate.findFirst({
          where: tenantWhere(scope, { id: template.parentVersionId }),
        });
        inheritDefault = Boolean(parent?.isDefault);
        await tx.proposalTemplate.updateMany({
          where: tenantWhere(scope, { id: template.parentVersionId }),
          data: { isCurrent: false, isDefault: false },
        });
      }
      await tx.proposalTemplate.updateMany({
        where: tenantWhere(scope, { id }),
        data: {
          status: "active",
          isCurrent: true,
          publishedAt: new Date(),
          ...(inheritDefault ? { isDefault: true } : {}),
        },
      });
      return tx.proposalTemplate.findFirst({
        where: tenantWhere(scope, { id }),
      });
    });
  }

  @OrgScoped()
  async softDeleteTemplate(scope: OrgScope, id: number) {
    const result = await this.prisma.proposalTemplate.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), status: "archived" },
    });
    return result.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  @OrgScoped()
  async findDocuments(scope: OrgScope, query: QueryProposalDocumentDto) {
    const where: Prisma.ProposalDocumentWhereInput = tenantWhere(scope, {
      deletedAt: null,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.templateId ? { templateId: query.templateId } : {}),
      ...(query.clientName ? { clientName: query.clientName } : {}),
      ...(query.followUpDue
        ? {
            dueDate: { lte: startOfTodayUtc() },
            status: { notIn: FOLLOW_UP_CLOSED_STATUSES as never[] },
          }
        : {}),
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate
                ? {
                    lt: new Date(new Date(query.toDate).getTime() + 86_400_000),
                  }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              {
                proposalNumber: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              { clientName: { contains: query.search, mode: "insensitive" } },
              { projectName: { contains: query.search, mode: "insensitive" } },
              {
                templateTitle: { contains: query.search, mode: "insensitive" },
              },
            ],
          }
        : {}),
    });

    const [items, total] = await Promise.all([
      this.prisma.proposalDocument.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [
          { [query.sortBy ?? "createdAt"]: query.order ?? "desc" },
          { id: "desc" },
        ],
        include: { activities: CREATED_BY_ACTIVITY },
      }),
      this.prisma.proposalDocument.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Hub stat cards + the client filter's options (legacy computed these
   * from the full in-memory list). */
  @OrgScoped()
  async documentStats(scope: OrgScope) {
    const base = tenantWhere(scope, { deletedAt: null });
    const [byStatus, followUpsDue, clients] = await Promise.all([
      this.prisma.proposalDocument.groupBy({
        by: ["status"],
        where: base,
        _count: { _all: true },
      }),
      this.prisma.proposalDocument.count({
        where: tenantWhere(scope, {
          deletedAt: null,
          dueDate: { lte: startOfTodayUtc() },
          status: { notIn: FOLLOW_UP_CLOSED_STATUSES as never[] },
        }),
      }),
      this.prisma.proposalDocument.findMany({
        where: tenantWhere(scope, {
          deletedAt: null,
          clientName: { not: null },
        }),
        distinct: ["clientName"],
        select: { clientName: true },
        orderBy: { clientName: "asc" },
      }),
    ]);
    return { byStatus, followUpsDue, clients };
  }

  @OrgScoped()
  findDocumentById(scope: OrgScope, id: number) {
    return this.prisma.proposalDocument.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: { activities: { orderBy: { createdAt: "desc" } } },
    });
  }

  @OrgScoped()
  async createDocument(
    scope: OrgScope,
    dto: CreateProposalDocumentDto,
    project: ResolvedProposalProject | null,
    createdBy: number,
    createdByName: string,
    numberFormat: ProposalNumberFormat,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const proposalNumber = await issueProposalNumber(
        tx,
        scope.organizationId,
        numberFormat,
      );

      const template = dto.templateId
        ? await tx.proposalTemplate.findFirst({
            where: {
              id: dto.templateId,
              organizationId: scope.organizationId,
              deletedAt: null,
            },
          })
        : null;

      const document = await tx.proposalDocument.create({
        data: {
          organizationId: scope.organizationId,
          proposalNumber,
          title: dto.title,
          projectId: project?.id ?? null,
          projectCode: project?.code ?? null,
          projectName: project?.name ?? dto.projectName ?? null,
          clientId: dto.clientId ?? project?.clientId ?? null,
          clientName: dto.clientName ?? project?.clientName ?? null,
          templateId: template?.id ?? null,
          templateTitle: template?.title ?? null,
          templateCode: template?.code ?? null,
          templateVersion: template?.version ?? null,
          templateSnapshot: template
            ? (template.schemaJson as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          sectionValues: (dto.sectionValues ?? {}) as Prisma.InputJsonValue,
          proposalDate: dto.proposalDate ? new Date(dto.proposalDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          preparedBy: createdBy,
          createdBy,
          updatedBy: createdBy,
        },
      });

      await tx.proposalActivity.create({
        data: {
          organizationId: scope.organizationId,
          proposalId: document.id,
          userId: createdBy,
          userName: createdByName,
          action: "created",
          newStatus: document.status,
        },
      });

      return document;
    });
  }

  @OrgScoped()
  async updateDocument(
    scope: OrgScope,
    id: number,
    dto: UpdateProposalDocumentDto,
    project: ResolvedProposalProject | null | undefined,
    updatedBy: number,
  ) {
    const {
      sectionValues,
      proposalDate,
      dueDate,
      projectId: _p,
      ...rest
    } = dto;
    const result = await this.prisma.proposalDocument.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: {
        ...rest,
        ...(project !== undefined
          ? {
              projectId: project?.id ?? null,
              projectCode: project?.code ?? null,
              projectName: project?.name ?? dto.projectName ?? null,
            }
          : {}),
        ...(sectionValues !== undefined
          ? { sectionValues: sectionValues as Prisma.InputJsonValue }
          : {}),
        ...(proposalDate !== undefined
          ? { proposalDate: proposalDate ? new Date(proposalDate) : null }
          : {}),
        ...(dueDate !== undefined
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
        updatedBy,
      },
    });
    if (result.count === 0) return null;
    return this.findDocumentById(scope, id);
  }

  @OrgScoped()
  async transitionDocument(
    scope: OrgScope,
    id: number,
    newStatus: string,
    actorId: number,
    actorName: string,
    actorRole: string | undefined,
    action: string,
    previousStatus: string,
    comments: string | undefined,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.proposalDocument.updateMany({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        data: { status: newStatus as never, updatedBy: actorId },
      });
      await tx.proposalActivity.create({
        data: {
          organizationId: scope.organizationId,
          proposalId: id,
          userId: actorId,
          userName: actorName,
          userRole: actorRole ?? null,
          action,
          previousStatus,
          newStatus,
          comments: comments ?? null,
        },
      });
      return tx.proposalDocument.findFirst({
        where: { id, organizationId: scope.organizationId },
        include: { activities: { orderBy: { createdAt: "desc" } } },
      });
    });
  }

  @OrgScoped()
  async extendFollowup(
    scope: OrgScope,
    id: number,
    dueDate: string,
    actorId: number,
    actorName: string,
    reason: string | undefined,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.proposalDocument.updateMany({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        data: {
          dueDate: new Date(dueDate),
          followUpExtensionCount: { increment: 1 },
          updatedBy: actorId,
        },
      });
      await tx.proposalActivity.create({
        data: {
          organizationId: scope.organizationId,
          proposalId: id,
          userId: actorId,
          userName: actorName,
          action: "followup_extended",
          comments: reason ?? null,
        },
      });
      return tx.proposalDocument.findFirst({
        where: { id, organizationId: scope.organizationId },
      });
    });
  }

  /** Legacy hub "Duplicate" — a new draft with its own sequential number
   * (legacy appended `-COPY` to the number, which broke uniqueness),
   * carrying the source's template snapshot and section values. */
  @OrgScoped()
  async duplicateDocument(
    scope: OrgScope,
    sourceId: number,
    actorId: number,
    actorName: string,
    numberFormat: ProposalNumberFormat,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.proposalDocument.findFirst({
        where: tenantWhere(scope, { id: sourceId, deletedAt: null }),
      });
      if (!source) return null;
      const proposalNumber = await issueProposalNumber(
        tx,
        scope.organizationId,
        numberFormat,
      );
      const copy = await tx.proposalDocument.create({
        data: {
          organizationId: scope.organizationId,
          proposalNumber,
          title: `${source.title} (Copy)`.slice(0, 200),
          projectId: source.projectId,
          projectCode: source.projectCode,
          projectName: source.projectName,
          clientId: source.clientId,
          clientName: source.clientName,
          templateId: source.templateId,
          templateTitle: source.templateTitle,
          templateCode: source.templateCode,
          templateVersion: source.templateVersion,
          templateSnapshot:
            source.templateSnapshot === null
              ? Prisma.JsonNull
              : (source.templateSnapshot as Prisma.InputJsonValue),
          sectionValues: source.sectionValues as Prisma.InputJsonValue,
          proposalDate: new Date(),
          dueDate: source.dueDate,
          preparedBy: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await tx.proposalActivity.create({
        data: {
          organizationId: scope.organizationId,
          proposalId: copy.id,
          userId: actorId,
          userName: actorName,
          action: "created",
          newStatus: "draft",
          comments: `Duplicated from ${source.proposalNumber}`,
        },
      });
      return copy;
    });
  }

  @OrgScoped()
  async softDeleteDocument(scope: OrgScope, id: number) {
    const result = await this.prisma.proposalDocument.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Settings (one row per organization)
  // ---------------------------------------------------------------------------

  @OrgScoped()
  async getSettings(scope: OrgScope) {
    const existing = await this.prisma.proposalSettings.findFirst({
      where: { organizationId: scope.organizationId },
    });
    if (existing) return existing;
    return this.prisma.proposalSettings.create({
      data: { organizationId: scope.organizationId },
    });
  }

  @OrgScoped()
  async updateSettings(scope: OrgScope, dto: UpdateProposalSettingsDto) {
    await this.getSettings(scope);
    return this.prisma.proposalSettings.update({
      where: { organizationId: scope.organizationId },
      data: dto,
    });
  }
}
