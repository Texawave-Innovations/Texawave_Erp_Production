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
import { deriveGross } from "../revision-letters/revision-letters.rules.js";

const ENTITY_TYPE = "offer_letter";

type OfferRow = Prisma.OfferLetterGetPayload<Record<string, never>>;

export interface OfferLetterView {
  id: number;
  candidateName: string;
  role: string;
  location: string;
  reportingManager: string;
  offerDate: string;
  joiningDate: string;
  offerValidityDate: string;
  components: { basic: string; da: string; hra: string; ca: string };
  grossMonthly: string;
  grossAnnual: string;
  workSchedule: { monFri: string; sat: string; sun: string };
  signatoryName: string;
  signatoryDesignation: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  companyAddress: string;
  status: "GENERATED";
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const money = (value: Prisma.Decimal) => value.toFixed(2);

export function toOfferLetterView(row: OfferRow): OfferLetterView {
  return {
    id: row.id,
    candidateName: row.candidateName,
    role: row.role,
    location: row.location,
    reportingManager: row.reportingManager,
    offerDate: formatDateOnly(row.offerDate),
    joiningDate: formatDateOnly(row.joiningDate),
    offerValidityDate: formatDateOnly(row.offerValidityDate),
    components: {
      basic: money(row.basic),
      da: money(row.da),
      hra: money(row.hra),
      ca: money(row.ca),
    },
    ...deriveGross(row),
    workSchedule: {
      monFri: row.workScheduleMonFri,
      sat: row.workScheduleSat,
      sun: row.workScheduleSun,
    },
    signatoryName: row.signatoryName,
    signatoryDesignation: row.signatoryDesignation,
    companyEmail: row.companyEmail,
    companyPhone: row.companyPhone,
    companyWebsite: row.companyWebsite,
    companyAddress: row.companyAddress,
    status: "GENERATED",
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * R4 (Docs/HR_LEGACY_PARITY.md §10.5): the audit trail holds no salary amounts
 * and no candidate name. A change is recorded by field NAME in `changedFields`,
 * never by value. The record itself is readable only with `hr.offer_letter.read`.
 */
function snapshot(row: OfferRow) {
  return {
    role: row.role,
    location: row.location,
    offerDate: formatDateOnly(row.offerDate),
    joiningDate: formatDateOnly(row.joiningDate),
    offerValidityDate: formatDateOnly(row.offerValidityDate),
    status: row.status,
  };
}

export interface NewOfferLetter {
  candidateName: string;
  role: string;
  location: string;
  reportingManager: string;
  offerDate: string;
  joiningDate: string;
  offerValidityDate: string;
  basic: string;
  da: string;
  hra: string;
  ca: string;
  workScheduleMonFri: string;
  workScheduleSat: string;
  workScheduleSun: string;
  signatoryName: string;
  signatoryDesignation: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  companyAddress: string;
}

export type OfferLetterPatch = Partial<NewOfferLetter>;

/** Maps a patch onto Prisma columns. Only the keys present are written. */
function toColumns(patch: OfferLetterPatch): Prisma.OfferLetterUpdateInput {
  const {
    offerDate,
    joiningDate,
    offerValidityDate,
    workScheduleMonFri,
    workScheduleSat,
    workScheduleSun,
    ...rest
  } = patch;
  return {
    ...rest,
    ...(offerDate !== undefined ? { offerDate: parseDateOnly(offerDate) } : {}),
    ...(joiningDate !== undefined
      ? { joiningDate: parseDateOnly(joiningDate) }
      : {}),
    ...(offerValidityDate !== undefined
      ? { offerValidityDate: parseDateOnly(offerValidityDate) }
      : {}),
    ...(workScheduleMonFri !== undefined ? { workScheduleMonFri } : {}),
    ...(workScheduleSat !== undefined ? { workScheduleSat } : {}),
    ...(workScheduleSun !== undefined ? { workScheduleSun } : {}),
  };
}

export interface OfferLetterFilter {
  search?: string | undefined;
}

/** The only place `PrismaService` is called for offer letters. Organization-
 * scoped by design (no employee or team owner; see the `hr.offer_letter`
 * permissions in catalog.ts and HR_API.md). */
@Injectable()
export class OfferLettersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: OfferLetterFilter,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.OfferLetterWhereInput>(scope, {
      ...(filter.search
        ? {
            OR: [
              {
                candidateName: { contains: filter.search, mode: "insensitive" },
              },
              { role: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.offerLetter.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.offerLetter.count({ where }),
    ]);
    return { items: rows.map(toOfferLetterView), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.offerLetter.findFirst({
      where: tenantWhere(scope, { id }),
    });
    return row ? toOfferLetterView(row) : null;
  }

  /** Always GENERATED. Legacy never assigns another status. */
  @OrgScoped()
  async create(scope: OrgScope, input: NewOfferLetter, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.offerLetter.create({
        data: {
          organizationId: scope.organizationId,
          candidateName: input.candidateName,
          role: input.role,
          location: input.location,
          reportingManager: input.reportingManager,
          offerDate: parseDateOnly(input.offerDate),
          joiningDate: parseDateOnly(input.joiningDate),
          offerValidityDate: parseDateOnly(input.offerValidityDate),
          basic: input.basic,
          da: input.da,
          hra: input.hra,
          ca: input.ca,
          workScheduleMonFri: input.workScheduleMonFri,
          workScheduleSat: input.workScheduleSat,
          workScheduleSun: input.workScheduleSun,
          signatoryName: input.signatoryName,
          signatoryDesignation: input.signatoryDesignation,
          companyEmail: input.companyEmail,
          companyPhone: input.companyPhone,
          companyWebsite: input.companyWebsite,
          companyAddress: input.companyAddress,
          status: "GENERATED",
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
      return toOfferLetterView(created);
    });
  }

  /** Overwrites the stored terms, as legacy does. Locked, scoped by org, and
   * audited with the field names that changed. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    patch: OfferLetterPatch,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM hr.offer_letters
         WHERE id = ${id} AND organization_id = ${scope.organizationId}
         FOR UPDATE`;
      const before = await tx.offerLetter.findFirst({
        where: tenantWhere(scope, { id }),
      });
      if (!before) return null;

      const after = await tx.offerLetter.update({
        where: { id },
        data: { ...toColumns(patch), updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: { ...snapshot(after), changedFields: Object.keys(patch).sort() },
      });
      return toOfferLetterView(after);
    });
  }
}
