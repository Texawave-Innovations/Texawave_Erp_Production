import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { InterviewMode, InterviewStatus } from "./dto/interview.dto.js";

const ENTITY_TYPE = "interview";

type InterviewRow = Prisma.InterviewGetPayload<Record<string, never>>;

export interface InterviewView {
  id: number;
  candidateName: string;
  roleTitle: string;
  interviewerName: string;
  interviewDate: string;
  interviewTime: string;
  mode: InterviewMode;
  status: InterviewStatus;
  notes: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toInterviewView(row: InterviewRow): InterviewView {
  return {
    id: row.id,
    candidateName: row.candidateName,
    roleTitle: row.roleTitle,
    interviewerName: row.interviewerName,
    interviewDate: formatDateOnly(row.interviewDate),
    interviewTime: row.interviewTime,
    mode: row.mode as InterviewMode,
    status: row.status as InterviewStatus,
    notes: row.notes,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Audit snapshot. Candidate and interviewer names are personal data and are
 * kept out of the trail, as leave-request reasons are. The row id identifies
 * the record. */
function snapshot(row: InterviewRow) {
  return {
    roleTitle: row.roleTitle,
    interviewDate: formatDateOnly(row.interviewDate),
    interviewTime: row.interviewTime,
    mode: row.mode,
    status: row.status,
  };
}

export interface NewInterview {
  candidateName: string;
  roleTitle: string;
  interviewerName: string;
  interviewDate: string;
  interviewTime: string;
  mode: InterviewMode;
  notes: string | null;
}

export interface InterviewFilter {
  search?: string | undefined;
  status?: InterviewStatus | undefined;
}

/**
 * The only place `PrismaService` is called for interviews. Organization-scoped
 * by design: the records carry no employee or team owner (see the
 * `hr.interview` permissions in catalog.ts and HR_API.md).
 */
@Injectable()
export class InterviewsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: InterviewFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.InterviewWhereInput>(scope, {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              {
                candidateName: { contains: filter.search, mode: "insensitive" },
              },
              { roleTitle: { contains: filter.search, mode: "insensitive" } },
              {
                interviewerName: {
                  contains: filter.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.interview.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [
          { interviewDate: pagination.order ?? "desc" },
          { id: "desc" },
        ],
      }),
      this.prisma.interview.count({ where }),
    ]);
    return { items: rows.map(toInterviewView), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.interview.findFirst({
      where: tenantWhere(scope, { id }),
    });
    return row ? toInterviewView(row) : null;
  }

  /** Always starts SCHEDULED, as legacy does on create. */
  @OrgScoped()
  async create(scope: OrgScope, input: NewInterview, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.interview.create({
        data: {
          organizationId: scope.organizationId,
          candidateName: input.candidateName,
          roleTitle: input.roleTitle,
          interviewerName: input.interviewerName,
          interviewDate: parseDateOnly(input.interviewDate),
          interviewTime: input.interviewTime,
          mode: input.mode,
          status: "SCHEDULED",
          notes: input.notes,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: created.id,
        action: "create",
        after: snapshot(created),
      });
      return toInterviewView(created);
    });
  }

  /**
   * Sets the status to any legacy value, including the current one. The row is
   * locked first so two status changes serialise, and the before/after status
   * are audited in the same transaction.
   */
  @OrgScoped()
  async setStatus(
    scope: OrgScope,
    id: number,
    status: InterviewStatus,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM hr.interviews
         WHERE id = ${id} AND organization_id = ${scope.organizationId}
         FOR UPDATE`;
      const before = await tx.interview.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!before) return null;

      const after = await tx.interview.update({
        where: { id },
        data: { status, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "status_change",
        before: { status: before.status },
        after: { status: after.status },
      });
      return toInterviewView(after);
    });
  }
}
