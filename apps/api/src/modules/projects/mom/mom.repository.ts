import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { randomUUID } from "node:crypto";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  CreateMomDocumentDto,
  QueryMomDocumentDto,
  UpdateMomDocumentDto,
} from "./dto/document.dto.js";
import type {
  CreateMomTemplateDto,
  UpdateMomTemplateDto,
} from "./dto/template.dto.js";
import { issueMomReference } from "./sequences/mom-sequences.js";

/** Project identity copied onto a MoM when it's linked (resolved by the
 * service through `ProjectsService`, never trusted from the client). */
export interface ResolvedMomProject {
  id: number;
  code: string;
  name: string;
  clientName: string | null;
}

function asJson(value: unknown[] | undefined, fallback: unknown[] = []) {
  return (value ?? fallback) as Prisma.InputJsonValue;
}

@Injectable()
export class MomRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  @OrgScoped()
  findTemplates(scope: OrgScope) {
    return this.prisma.momTemplate.findMany({
      where: tenantWhere(scope, { deletedAt: null }),
      orderBy: { createdAt: "desc" },
    });
  }

  @OrgScoped()
  findTemplateById(scope: OrgScope, id: number) {
    return this.prisma.momTemplate.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
    });
  }

  @OrgScoped()
  async createTemplate(
    scope: OrgScope,
    dto: CreateMomTemplateDto,
    createdBy: number,
  ) {
    if (dto.isDefault) {
      await this.prisma.momTemplate.updateMany({
        where: tenantWhere(scope, { isDefault: true }),
        data: { isDefault: false },
      });
    }
    return this.prisma.momTemplate.create({
      data: {
        organizationId: scope.organizationId,
        code: dto.code ?? null,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? null,
        sectionsJson: asJson(dto.sectionsJson),
        defaultAgendaJson: asJson(dto.defaultAgendaJson),
        defaultNoteRowsJson: asJson(dto.defaultNoteRowsJson),
        isDefault: dto.isDefault ?? false,
        createdBy,
      },
    });
  }

  @OrgScoped()
  async updateTemplate(scope: OrgScope, id: number, dto: UpdateMomTemplateDto) {
    if (dto.isDefault) {
      await this.prisma.momTemplate.updateMany({
        where: tenantWhere(scope, { isDefault: true }),
        data: { isDefault: false },
      });
    }
    const { sectionsJson, defaultAgendaJson, defaultNoteRowsJson, ...rest } =
      dto;
    const result = await this.prisma.momTemplate.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: {
        ...rest,
        ...(sectionsJson !== undefined
          ? { sectionsJson: asJson(sectionsJson) }
          : {}),
        ...(defaultAgendaJson !== undefined
          ? { defaultAgendaJson: asJson(defaultAgendaJson) }
          : {}),
        ...(defaultNoteRowsJson !== undefined
          ? { defaultNoteRowsJson: asJson(defaultNoteRowsJson) }
          : {}),
        ...(dto.status === "active" ? { publishedAt: new Date() } : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findTemplateById(scope, id);
  }

  /** Legacy `duplicateMomTemplate`/`createNewTemplateVersion` — a fresh
   * draft row cloned from `sourceId`, linked back via `parentVersionId`. */
  @OrgScoped()
  async cloneTemplate(
    scope: OrgScope,
    sourceId: number,
    overrides: { name: string; code: string | null; version: number },
    createdBy: number,
  ) {
    const source = await this.findTemplateById(scope, sourceId);
    if (!source) return null;
    return this.prisma.momTemplate.create({
      data: {
        organizationId: scope.organizationId,
        code: overrides.code,
        name: overrides.name,
        description: source.description,
        category: source.category,
        version: overrides.version,
        parentVersionId: source.id,
        status: "draft",
        isDefault: false,
        sectionsJson: source.sectionsJson as Prisma.InputJsonValue,
        defaultAgendaJson: source.defaultAgendaJson as Prisma.InputJsonValue,
        defaultNoteRowsJson:
          source.defaultNoteRowsJson as Prisma.InputJsonValue,
        additionalSectionsJson:
          source.additionalSectionsJson as Prisma.InputJsonValue,
        createdBy,
      },
    });
  }

  /** The template a new MoM uses when the caller doesn't pick one — the
   * active default, else the newest active template (legacy editor's
   * `allTemplates.find(t => t.isDefault && t.status === 'active') || ...`). */
  @OrgScoped()
  findDefaultActiveTemplate(scope: OrgScope) {
    return this.prisma.momTemplate.findFirst({
      where: tenantWhere(scope, {
        deletedAt: null,
        status: "active" as const,
      }),
      orderBy: [{ isDefault: "desc" }, { publishedAt: "desc" }],
    });
  }

  @OrgScoped()
  async softDeleteTemplate(scope: OrgScope, id: number) {
    const result = await this.prisma.momTemplate.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date(), status: "archived" },
    });
    return result.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  @OrgScoped()
  async findDocuments(scope: OrgScope, query: QueryMomDocumentDto) {
    const where: Prisma.MomDocumentWhereInput = tenantWhere(scope, {
      deletedAt: null,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            meetingDate: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                meetingTitle: { contains: query.search, mode: "insensitive" },
              },
              { reference: { contains: query.search, mode: "insensitive" } },
              { clientName: { contains: query.search, mode: "insensitive" } },
              { projectName: { contains: query.search, mode: "insensitive" } },
              { projectCode: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });

    const sortField = query.sortBy ?? "meetingDate";
    const [items, total] = await Promise.all([
      this.prisma.momDocument.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [{ [sortField]: query.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.momDocument.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Register header metrics (legacy `MomRegisterPage` stat cards). */
  @OrgScoped()
  async countDocumentsByStatus(scope: OrgScope) {
    const rows = await this.prisma.momDocument.groupBy({
      by: ["status"],
      where: tenantWhere(scope, { deletedAt: null }),
      _count: { _all: true },
    });
    const inRevision = await this.prisma.momDocument.count({
      where: tenantWhere(scope, {
        deletedAt: null,
        workingRevision: { not: null },
      }),
    });
    return { rows, inRevision };
  }

  @OrgScoped()
  findByProjectId(scope: OrgScope, projectId: number) {
    return this.prisma.momDocument.findMany({
      where: tenantWhere(scope, { projectId, deletedAt: null }),
      orderBy: { meetingDate: "desc" },
    });
  }

  @OrgScoped()
  findDocumentById(scope: OrgScope, id: number) {
    return this.prisma.momDocument.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: {
        revisions: { orderBy: { revisionNumber: "desc" } },
        history: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  @OrgScoped()
  async createDocument(
    scope: OrgScope,
    dto: CreateMomDocumentDto,
    project: ResolvedMomProject | null,
    createdBy: number,
    createdByName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reference = await issueMomReference(tx, scope.organizationId);

      const template = dto.templateId
        ? await tx.momTemplate.findFirst({
            where: {
              id: dto.templateId,
              organizationId: scope.organizationId,
              deletedAt: null,
            },
          })
        : null;

      const document = await tx.momDocument.create({
        data: {
          organizationId: scope.organizationId,
          reference,
          projectId: project?.id ?? null,
          projectCode: project?.code ?? null,
          projectName: project?.name ?? dto.projectName ?? null,
          clientName: dto.clientName ?? project?.clientName ?? null,
          meetingTitle: dto.meetingTitle,
          meetingDate: new Date(dto.meetingDate),
          startTime: dto.startTime ?? null,
          endTime: dto.endTime ?? null,
          timezone: dto.timezone ?? null,
          location: dto.location ?? null,
          attendeesJson: asJson(dto.attendeesJson),
          absenteesJson: asJson(dto.absenteesJson),
          agendaJson: asJson(dto.agendaJson),
          meetingNotesJson: asJson(dto.meetingNotesJson),
          additionalSectionsJson: asJson(dto.additionalSectionsJson),
          freeTextContent: dto.freeTextContent ?? null,
          templateId: template?.id ?? null,
          templateTitle: template?.name ?? null,
          templateVersion: template?.version ?? null,
          templateSnapshot: template
            ? (template.sectionsJson as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          versionToken: randomUUID(),
          createdBy,
          updatedBy: createdBy,
        },
      });

      await tx.momHistoryEvent.create({
        data: {
          organizationId: scope.organizationId,
          momId: document.id,
          userId: createdBy,
          userName: createdByName,
          action: "created",
          details: `Meeting minutes ${reference} created as a draft.`,
        },
      });

      return document;
    });
  }

  @OrgScoped()
  async updateDocument(
    scope: OrgScope,
    id: number,
    dto: UpdateMomDocumentDto,
    project: ResolvedMomProject | null,
    updatedBy: number,
    updatedByName: string,
    isRevision: boolean,
  ) {
    const { versionToken: _ignored, ...fields } = dto;
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.momDocument.updateMany({
        where: tenantWhere(scope, { id, deletedAt: null }),
        data: {
          meetingTitle: fields.meetingTitle,
          meetingDate: new Date(fields.meetingDate),
          startTime: fields.startTime ?? null,
          endTime: fields.endTime ?? null,
          timezone: fields.timezone ?? null,
          location: fields.location ?? null,
          projectId: project?.id ?? null,
          projectCode: project?.code ?? null,
          projectName: project?.name ?? fields.projectName ?? null,
          clientName: fields.clientName ?? project?.clientName ?? null,
          attendeesJson: asJson(fields.attendeesJson),
          absenteesJson: asJson(fields.absenteesJson),
          agendaJson: asJson(fields.agendaJson),
          meetingNotesJson: asJson(fields.meetingNotesJson),
          additionalSectionsJson: asJson(fields.additionalSectionsJson),
          freeTextContent: fields.freeTextContent ?? null,
          versionToken: randomUUID(),
          updatedBy,
        },
      });
      if (result.count === 0) return false;
      await tx.momHistoryEvent.create({
        data: {
          organizationId: scope.organizationId,
          momId: id,
          userId: updatedBy,
          userName: updatedByName,
          action: "saved_draft",
          details: isRevision
            ? "Saved working revision changes."
            : "Saved draft updates.",
        },
      });
      return true;
    });
  }

  @OrgScoped()
  async finalize(
    scope: OrgScope,
    id: number,
    actorId: number,
    actorName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.momDocument.updateMany({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        data: {
          status: "finalized",
          currentRevision: { increment: 0 },
          updatedBy: actorId,
        },
      });
      await tx.momHistoryEvent.create({
        data: {
          organizationId: scope.organizationId,
          momId: id,
          userId: actorId,
          userName: actorName,
          action: "finalized",
        },
      });
      return tx.momDocument.findFirst({
        where: { id, organizationId: scope.organizationId },
      });
    });
  }

  @OrgScoped()
  async startRevision(
    scope: OrgScope,
    id: number,
    current: {
      meetingTitle: string;
      meetingDate: Date;
      startTime: string | null;
      endTime: string | null;
      timezone: string | null;
      location: string | null;
      attendeesJson: Prisma.JsonValue;
      absenteesJson: Prisma.JsonValue;
      agendaJson: Prisma.JsonValue;
      meetingNotesJson: Prisma.JsonValue;
      additionalSectionsJson: Prisma.JsonValue;
      freeTextContent: string | null;
      status: string;
      currentRevision: number;
    },
    actorId: number,
    actorName: string,
    reason: string | undefined,
  ) {
    const nextRevision = current.currentRevision + 1;
    return this.prisma.$transaction(async (tx) => {
      await tx.momRevision.create({
        data: {
          organizationId: scope.organizationId,
          momId: id,
          revisionNumber: current.currentRevision,
          userId: actorId,
          userName: actorName,
          changeSummary: reason ?? null,
          snapshotJson: current as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.momDocument.updateMany({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        data: {
          previousStatus: current.status,
          workingRevision: nextRevision,
          workingRevisionReason: reason ?? null,
          currentRevision: nextRevision,
          updatedBy: actorId,
        },
      });
      await tx.momHistoryEvent.create({
        data: {
          organizationId: scope.organizationId,
          momId: id,
          userId: actorId,
          userName: actorName,
          action: "revision_started",
          details: reason ?? null,
        },
      });
      return tx.momDocument.findFirst({
        where: { id, organizationId: scope.organizationId },
      });
    });
  }

  @OrgScoped()
  async finalizeRevision(
    scope: OrgScope,
    id: number,
    actorId: number,
    actorName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.momDocument.updateMany({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        data: {
          status: "finalized",
          workingRevision: null,
          workingRevisionReason: null,
          previousStatus: null,
          updatedBy: actorId,
        },
      });
      await tx.momHistoryEvent.create({
        data: {
          organizationId: scope.organizationId,
          momId: id,
          userId: actorId,
          userName: actorName,
          action: "revised_version_finalized",
        },
      });
      return tx.momDocument.findFirst({
        where: { id, organizationId: scope.organizationId },
      });
    });
  }

  @OrgScoped()
  async archive(
    scope: OrgScope,
    id: number,
    actorId: number,
    actorName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.momDocument.findFirst({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });
      await tx.momDocument.updateMany({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        data: {
          status: "archived",
          previousStatus: existing?.status ?? null,
          updatedBy: actorId,
        },
      });
      await tx.momHistoryEvent.create({
        data: {
          organizationId: scope.organizationId,
          momId: id,
          userId: actorId,
          userName: actorName,
          action: "archived",
        },
      });
      return tx.momDocument.findFirst({
        where: { id, organizationId: scope.organizationId },
      });
    });
  }

  @OrgScoped()
  async restore(
    scope: OrgScope,
    id: number,
    actorId: number,
    actorName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.momDocument.findFirst({
        where: { id, organizationId: scope.organizationId },
      });
      const restoredStatus = existing?.previousStatus ?? "draft";
      await tx.momDocument.updateMany({
        where: { id, organizationId: scope.organizationId },
        data: {
          status: restoredStatus as never,
          previousStatus: null,
          updatedBy: actorId,
        },
      });
      await tx.momHistoryEvent.create({
        data: {
          organizationId: scope.organizationId,
          momId: id,
          userId: actorId,
          userName: actorName,
          action: "restored",
        },
      });
      return tx.momDocument.findFirst({
        where: { id, organizationId: scope.organizationId },
      });
    });
  }

  @OrgScoped()
  async softDeleteDocument(scope: OrgScope, id: number) {
    const result = await this.prisma.momDocument.updateMany({
      where: tenantWhere(scope, { id, deletedAt: null }),
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  }
}
