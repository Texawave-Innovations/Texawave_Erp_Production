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
  deriveGross,
  financialYearLabel,
  formatRevisionDocumentNo,
  revisionDocPrefix,
  revisionDocType,
  REVISION_DOC_PADDING,
} from "./revision-letters.rules.js";

const ENTITY_TYPE = "revision_letter";

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
} satisfies Prisma.RevisionLetterInclude;
type RevisionLetterRow = Prisma.RevisionLetterGetPayload<{
  include: typeof INCLUDE;
}>;

export interface RevisionLetterView {
  id: number;
  documentNo: string;
  employee: { id: number; employeeCode: string; fullName: string };
  employeeName: string;
  designation: string;
  location: string;
  letterDate: string;
  effectiveDate: string;
  components: { basic: string; da: string; hra: string; ca: string };
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

const money = (value: Prisma.Decimal) => value.toFixed(2);

export function toRevisionLetterView(
  row: RevisionLetterRow,
): RevisionLetterView {
  return {
    id: row.id,
    documentNo: row.documentNo,
    employee: {
      id: row.employee.id,
      employeeCode: row.employee.employeeCode,
      fullName: row.employee.fullName,
    },
    employeeName: row.employeeName,
    designation: row.designation,
    location: row.location,
    letterDate: formatDateOnly(row.letterDate),
    effectiveDate: formatDateOnly(row.effectiveDate),
    components: {
      basic: money(row.basic),
      da: money(row.da),
      hra: money(row.hra),
      ca: money(row.ca),
    },
    ...deriveGross(row),
    signatoryName: row.signatoryName,
    signatoryDesignation: row.signatoryDesignation,
    status: "GENERATED",
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Allow-listed audit snapshot. Salary components are kept: an audit trail of
 * a salary change is the point of it. Free text is not duplicated here. */
/**
 * R4 (Docs/HR_LEGACY_PARITY.md §10.5): salary amounts are NOT written to the
 * audit trail. `audit.log.read` is a generic platform permission and must not
 * expose salary by accident. The audit records that a salary component changed
 * (its NAME, in `changedFields`), never the amount. Use the `hr.revision_letter`
 * read permission to see amounts.
 */
function snapshot(row: RevisionLetterRow) {
  return {
    employeeId: row.employeeId,
    documentNo: row.documentNo,
    designation: row.designation,
    location: row.location,
    letterDate: formatDateOnly(row.letterDate),
    effectiveDate: formatDateOnly(row.effectiveDate),
    signatoryName: row.signatoryName,
    signatoryDesignation: row.signatoryDesignation,
    status: row.status,
  };
}

export interface RevisionLetterFilter {
  employeeId?: number | undefined;
}

/** Values the service has already defaulted and validated. */
export interface NewRevisionLetter {
  employeeId: number;
  designation: string;
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

export type RevisionLetterPatch = Partial<
  Omit<NewRevisionLetter, "employeeId" | "issuedOn">
>;

/**
 * Issues the next document number for a financial year. Same concurrency
 * model as `issueEmployeeCode` (employees/employee-code.ts): the upsert plus
 * `UPDATE … next_number + 1` takes a row lock, so two concurrent issuers cannot
 * be given the same number, and a rolled-back letter gives its number back.
 * The `(organization_id, document_no)` unique index is the independent backstop.
 */
async function issueDocumentNo(
  tx: Prisma.TransactionClient,
  organizationId: number,
  fy: string,
): Promise<string> {
  const docType = revisionDocType(fy);
  const prefix = revisionDocPrefix(fy);
  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    VALUES
      (${organizationId}, ${docType}, ${prefix}, ${REVISION_DOC_PADDING}, 1, now())
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
      `No active revision-letter sequence for organization ${organizationId} (${fy})`,
    );
  }
  return formatRevisionDocumentNo(row.prefix, row.padding, row.issued);
}

/** The only place `PrismaService` is called for revision letters. Reads go
 * through `teamWhere()` via the employee; writes are one transaction holding
 * the row lock, the change and its audit row. */
@Injectable()
export class RevisionLettersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: RevisionLetterFilter,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(
      scope,
      filter.employeeId !== undefined ? { employeeId: filter.employeeId } : {},
      VIA_EMPLOYEE,
    );
    const [rows, total] = await Promise.all([
      this.prisma.revisionLetter.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.revisionLetter.count({ where }),
    ]);
    return { items: rows.map(toRevisionLetterView), total };
  }

  /** 404 (null) outside the caller's scope — never 403. */
  @TeamScoped()
  async findOne(scope: TeamScope, id: number) {
    const row = await this.prisma.revisionLetter.findFirst({
      where: teamWhere(scope, { id }, VIA_EMPLOYEE),
      include: INCLUDE,
    });
    return row ? toRevisionLetterView(row) : null;
  }

  /**
   * Issues a letter to an employee inside the caller's scope. An employee the
   * caller may not reach is reported exactly like one that does not exist
   * (422), so employee ids cannot be probed across teams or organizations.
   */
  @TeamScoped()
  async create(scope: TeamScope, input: NewRevisionLetter, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: teamWhere(scope, { id: input.employeeId, deletedAt: null }),
        select: { id: true, fullName: true },
      });
      if (!employee) {
        throw new BusinessRuleViolationException(
          "Employee not found",
          "INVALID_EMPLOYEE",
        );
      }

      const fy = financialYearLabel(input.issuedOn);
      const documentNo = await issueDocumentNo(tx, scope.organizationId, fy);

      const created = await tx.revisionLetter.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: employee.id,
          documentNo,
          employeeName: employee.fullName,
          designation: input.designation,
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
      return toRevisionLetterView(created);
    });
  }

  /**
   * Edits a letter in the caller's scope. The row is locked first, then found
   * THROUGH the scope (null → 404), so a concurrent edit serialises and an edit
   * outside scope changes nothing. The employee link and document number never
   * change.
   */
  @TeamScoped()
  async update(
    scope: TeamScope,
    id: number,
    patch: RevisionLetterPatch,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM hr.revision_letters
         WHERE id = ${id} AND organization_id = ${scope.organizationId}
         FOR UPDATE`;
      const before = await tx.revisionLetter.findFirst({
        where: teamWhere(scope, { id }, VIA_EMPLOYEE),
        include: INCLUDE,
      });
      if (!before) return null;

      const after = await tx.revisionLetter.update({
        where: { id },
        data: {
          ...(patch.designation !== undefined
            ? { designation: patch.designation }
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
      return toRevisionLetterView(after);
    });
  }
}
