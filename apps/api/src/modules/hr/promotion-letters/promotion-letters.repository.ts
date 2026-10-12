import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  compareSalaryHistory,
  deriveGross,
  financialYearLabel,
  formatPromotionDocumentNo,
  promotionDocPrefix,
  promotionDocType,
  PROMOTION_DOC_PADDING,
  type SalaryHistoryKind,
} from "./promotion-letters.rules.js";

const ENTITY_TYPE = "promotion_letter";

/** A letter is reached THROUGH its employee: the employee's team and user
 * decide who may see or change it. */
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE = {
  employee: {
    select: { id: true, employeeCode: true, fullName: true, userId: true },
  },
} satisfies Prisma.PromotionLetterInclude;
type PromotionLetterRow = Prisma.PromotionLetterGetPayload<{
  include: typeof INCLUDE;
}>;

interface Components {
  basic: string;
  da: string;
  hra: string;
  ca: string;
}

export interface PromotionLetterView {
  id: number;
  documentNo: string;
  employee: { id: number; employeeCode: string; fullName: string };
  employeeName: string;
  designationId: number;
  designation: string;
  previousDesignation: string;
  location: string;
  letterDate: string;
  effectiveDate: string;
  components: Components;
  grossMonthly: string;
  grossAnnual: string;
  signatoryName: string;
  signatoryDesignation: string;
  status: "GENERATED";
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One row of an employee's salary history: a revision or a promotion letter,
 * reduced to what the history dropdown shows. */
export interface SalaryHistoryEntryView {
  kind: SalaryHistoryKind;
  id: number;
  documentNo: string;
  designation: string;
  /** Promotions only; null for a revision. */
  previousDesignation: string | null;
  letterDate: string;
  effectiveDate: string;
  components: Components;
  grossMonthly: string;
  grossAnnual: string;
}

export interface SalaryHistoryView {
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    currentDesignation: string;
  };
  /** False when the caller cannot read this employee's revision letters, so
   * revisions are left out — never silently shown through this route. */
  revisionsIncluded: boolean;
  entries: SalaryHistoryEntryView[];
}

const money = (value: Prisma.Decimal) => value.toFixed(2);

interface LetterColumns {
  basic: Prisma.Decimal;
  da: Prisma.Decimal;
  hra: Prisma.Decimal;
  ca: Prisma.Decimal;
}

function salaryOf(row: LetterColumns) {
  return {
    components: {
      basic: money(row.basic),
      da: money(row.da),
      hra: money(row.hra),
      ca: money(row.ca),
    },
    ...deriveGross(row),
  };
}

export function toPromotionLetterView(
  row: PromotionLetterRow,
): PromotionLetterView {
  return {
    id: row.id,
    documentNo: row.documentNo,
    employee: {
      id: row.employee.id,
      employeeCode: row.employee.employeeCode,
      fullName: row.employee.fullName,
    },
    employeeName: row.employeeName,
    designationId: row.designationId,
    designation: row.designation,
    previousDesignation: row.previousDesignation,
    location: row.location,
    letterDate: formatDateOnly(row.letterDate),
    effectiveDate: formatDateOnly(row.effectiveDate),
    ...salaryOf(row),
    signatoryName: row.signatoryName,
    signatoryDesignation: row.signatoryDesignation,
    status: "GENERATED",
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Allow-listed audit snapshot. R4 (Docs/HR_LEGACY_PARITY.md §10.5): salary
 * amounts are NOT written to the audit trail — an update records the changed
 * field NAMES in `changedFields`, never the amounts.
 */
function snapshot(row: PromotionLetterRow) {
  return {
    employeeId: row.employeeId,
    documentNo: row.documentNo,
    designationId: row.designationId,
    designation: row.designation,
    previousDesignation: row.previousDesignation,
    location: row.location,
    letterDate: formatDateOnly(row.letterDate),
    effectiveDate: formatDateOnly(row.effectiveDate),
    signatoryName: row.signatoryName,
    signatoryDesignation: row.signatoryDesignation,
    status: row.status,
  };
}

export interface PromotionLetterFilter {
  employeeId?: number | undefined;
}

/** Values the service has already defaulted and validated. */
export interface NewPromotionLetter {
  employeeId: number;
  designationId: number;
  location: string;
  letterDate: string;
  effectiveDate: string;
  basic: string;
  da: string;
  hra: string;
  ca: string;
  signatoryName: string;
  signatoryDesignation: string;
  /** Used only to pick the financial year of the document number. */
  issuedOn: Date;
}

export type PromotionLetterPatch = Partial<
  Omit<NewPromotionLetter, "employeeId" | "issuedOn">
>;

/** Same concurrency model as the revision-letter counter: the upsert plus
 * `UPDATE … next_number + 1` takes a row lock, so concurrent issuers never
 * share a number and a rolled-back letter gives its number back. The
 * `(organization_id, document_no)` unique index is the backstop. */
async function issueDocumentNo(
  tx: Prisma.TransactionClient,
  organizationId: number,
  fy: string,
): Promise<string> {
  const docType = promotionDocType(fy);
  const prefix = promotionDocPrefix(fy);
  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    VALUES
      (${organizationId}, ${docType}, ${prefix}, ${PROMOTION_DOC_PADDING}, 1, now())
    ON CONFLICT (organization_id, doc_type) DO NOTHING`;

  const rows = await tx.$queryRaw<
    Array<{ prefix: string; padding: number; issued: number }>
  >`
    UPDATE platform.document_sequences
       SET next_number = next_number + 1, updated_at = now()
     WHERE organization_id = ${organizationId}
       AND doc_type = ${docType}
       AND deleted_at IS NULL
    RETURNING prefix, padding, next_number - 1 AS issued`;

  const row = rows[0];
  if (!row) {
    throw new Error(
      `No active promotion-letter sequence for organization ${organizationId} (${fy})`,
    );
  }
  return formatPromotionDocumentNo(row.prefix, row.padding, row.issued);
}

/** An active designation of the caller's organization, or 422 — an unknown,
 * inactive or other-organization id are reported the same way. */
async function findDesignation(
  tx: Prisma.TransactionClient,
  organizationId: number,
  designationId: number,
) {
  const designation = await tx.designation.findFirst({
    where: {
      id: designationId,
      organizationId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, name: true },
  });
  if (!designation) {
    throw new BusinessRuleViolationException(
      "Designation not found or inactive",
      "INVALID_DESIGNATION",
    );
  }
  return designation;
}

/** The only place `PrismaService` is called for promotion letters. Reads go
 * through `teamWhere()` via the employee; writes are one transaction holding
 * the row lock, the change and its audit row. */
@Injectable()
export class PromotionLettersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: PromotionLetterFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(
      scope,
      filter.employeeId !== undefined ? { employeeId: filter.employeeId } : {},
      VIA_EMPLOYEE,
    );
    const [rows, total] = await Promise.all([
      this.prisma.promotionLetter.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.promotionLetter.count({ where }),
    ]);
    return { items: rows.map(toPromotionLetterView), total };
  }

  /** 404 (null) outside the caller's scope — never 403. */
  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    const row = await this.prisma.promotionLetter.findFirst({
      where: teamWhere(scope, { id }, VIA_EMPLOYEE),
      include: INCLUDE,
    });
    return row ? toPromotionLetterView(row) : null;
  }

  /**
   * Past salary of one employee: their revision letters and promotion
   * letters, newest effective date first. The employee must be inside the
   * promotion-letter read scope (null → 404). Revision letters are a separate
   * permission, so they are included only when `revisionScope` is given, and
   * then still filtered through it.
   */
  @TeamScoped()
  async salaryHistory(
    scope: TeamScope,
    revisionScope: TeamScope | null,
    employeeId: number,
  ): Promise<SalaryHistoryView | null> {
    const employee = await this.prisma.employee.findFirst({
      where: teamWhere(scope, { id: employeeId, deletedAt: null }),
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        designation: { select: { name: true } },
      },
    });
    if (!employee) return null;

    const [promotions, revisions] = await Promise.all([
      this.prisma.promotionLetter.findMany({
        where: teamWhere(scope, { employeeId }, VIA_EMPLOYEE),
      }),
      revisionScope
        ? this.prisma.revisionLetter.findMany({
            where: teamWhere(revisionScope, { employeeId }, VIA_EMPLOYEE),
          })
        : Promise.resolve([]),
    ]);

    const entries: SalaryHistoryEntryView[] = [
      ...promotions.map((row) => ({
        kind: "PROMOTION" as const,
        id: row.id,
        documentNo: row.documentNo,
        designation: row.designation,
        previousDesignation: row.previousDesignation,
        letterDate: formatDateOnly(row.letterDate),
        effectiveDate: formatDateOnly(row.effectiveDate),
        ...salaryOf(row),
      })),
      ...revisions.map((row) => ({
        kind: "REVISION" as const,
        id: row.id,
        documentNo: row.documentNo,
        designation: row.designation,
        previousDesignation: null,
        letterDate: formatDateOnly(row.letterDate),
        effectiveDate: formatDateOnly(row.effectiveDate),
        ...salaryOf(row),
      })),
    ].sort(compareSalaryHistory);

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        currentDesignation: employee.designation.name,
      },
      revisionsIncluded: revisionScope !== null,
      entries,
    };
  }

  /**
   * Issues a letter to an employee inside the caller's scope. An employee the
   * caller may not reach is reported exactly like one that does not exist
   * (422), so employee ids cannot be probed across teams or organizations.
   * The previous designation is the employee's current master designation.
   */
  @TeamScoped()
  async create(scope: TeamScope, input: NewPromotionLetter, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: teamWhere(scope, { id: input.employeeId, deletedAt: null }),
        select: {
          id: true,
          fullName: true,
          designation: { select: { name: true } },
        },
      });
      if (!employee) {
        throw new BusinessRuleViolationException(
          "Employee not found",
          "INVALID_EMPLOYEE",
        );
      }
      const designation = await findDesignation(
        tx,
        scope.organizationId,
        input.designationId,
      );

      const fy = financialYearLabel(input.issuedOn);
      const documentNo = await issueDocumentNo(tx, scope.organizationId, fy);

      const created = await tx.promotionLetter.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: employee.id,
          designationId: designation.id,
          documentNo,
          employeeName: employee.fullName,
          previousDesignation: employee.designation.name,
          designation: designation.name,
          location: input.location,
          letterDate: parseDateOnly(input.letterDate),
          effectiveDate: parseDateOnly(input.effectiveDate),
          basic: input.basic,
          da: input.da,
          hra: input.hra,
          ca: input.ca,
          signatoryName: input.signatoryName,
          signatoryDesignation: input.signatoryDesignation,
          status: "GENERATED",
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
      return toPromotionLetterView(created);
    });
  }

  /**
   * Edits a letter in the caller's scope. The row is locked first, then found
   * THROUGH the scope (null → 404). A new `designationId` re-snapshots the
   * designation name; the employee link, previous designation and document
   * number never change.
   */
  @TeamScoped()
  async update(
    scope: TeamScope,
    id: number,
    patch: PromotionLetterPatch,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM hr.promotion_letters
         WHERE id = ${id} AND organization_id = ${scope.organizationId}
         FOR UPDATE`;
      const before = await tx.promotionLetter.findFirst({
        where: teamWhere(scope, { id }, VIA_EMPLOYEE),
        include: INCLUDE,
      });
      if (!before) return null;

      const designation =
        patch.designationId !== undefined
          ? await findDesignation(tx, scope.organizationId, patch.designationId)
          : null;

      const after = await tx.promotionLetter.update({
        where: { id },
        data: {
          ...(designation
            ? { designationId: designation.id, designation: designation.name }
            : {}),
          ...(patch.location !== undefined ? { location: patch.location } : {}),
          ...(patch.letterDate !== undefined
            ? { letterDate: parseDateOnly(patch.letterDate) }
            : {}),
          ...(patch.effectiveDate !== undefined
            ? { effectiveDate: parseDateOnly(patch.effectiveDate) }
            : {}),
          ...(patch.basic !== undefined ? { basic: patch.basic } : {}),
          ...(patch.da !== undefined ? { da: patch.da } : {}),
          ...(patch.hra !== undefined ? { hra: patch.hra } : {}),
          ...(patch.ca !== undefined ? { ca: patch.ca } : {}),
          ...(patch.signatoryName !== undefined
            ? { signatoryName: patch.signatoryName }
            : {}),
          ...(patch.signatoryDesignation !== undefined
            ? { signatoryDesignation: patch.signatoryDesignation }
            : {}),
          updatedBy: actorId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: { ...snapshot(after), changedFields: Object.keys(patch).sort() },
      });
      return toPromotionLetterView(after);
    });
  }
}
