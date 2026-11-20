import { Injectable } from "@nestjs/common";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import {
  teamWhere,
  type TeamWhereFields,
} from "../../../common/tenancy/team-where.js";
import { isDocumentType } from "../../employee-self-service/profile/dto/onboarding-rules.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

/** employee_documents carries teamId directly, but owner (self) access runs
 * through the employee's user, not a column on this table. */
const VIA_EMPLOYEE: TeamWhereFields = { ownerField: "employee.userId" };

/** For an ad-hoc document the stored documentType is the free-text label HR
 * typed, which can be a person's name or a note. The audit trail records the
 * standard type when there is one and a fixed marker otherwise. */
function auditDocumentType(documentType: string): string {
  return isDocumentType(documentType) ? documentType : "AD_HOC";
}

export interface NewHrDocument {
  organizationId: number;
  teamId: number;
  employeeId: number;
  label: string;
  documentType: string | null;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}

/** The only place PrismaService is called for this module. Every method is
 * @TeamScoped() — unlike apps/api/src/modules/employee-self-service/profile,
 * this module serves HR staff acting on an employee who is not themselves,
 * so the caller's scope level genuinely narrows the rows (Docs/CODING_STANDARDS.md §10a). */
@Injectable()
export class EmployeeDocumentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /** Whether the employee is inside the caller's scope for THIS permission.
   * The employee lookup the service does first uses the employee-read scope,
   * which can be broader than the document-write scope the caller holds. */
  @TeamScoped()
  async employeeInScope(scope: TeamScope, employeeId: number) {
    const row = await this.prisma.employee.findFirst({
      where: teamWhere(scope, { id: employeeId, deletedAt: null }),
      select: { id: true },
    });
    return row !== null;
  }

  @TeamScoped()
  list(scope: TeamScope, employeeId: number) {
    return this.prisma.employeeDocument.findMany({
      where: teamWhere(scope, { employeeId, deletedAt: null }, VIA_EMPLOYEE),
      orderBy: { uploadedAt: "desc" },
    });
  }

  @TeamScoped()
  getById(scope: TeamScope, employeeId: number, id: number) {
    return this.prisma.employeeDocument.findFirst({
      where: teamWhere(
        scope,
        { id, employeeId, deletedAt: null },
        VIA_EMPLOYEE,
      ),
    });
  }

  /** Always inserts a new row — HR_UPLOADED documents are never upserted by
   * type/label, unlike onboarding's one-per-type rows (profile.repository.ts). */
  /** Audit metadata is ids and classification only: never the file name,
   * label or contents. */
  @TeamScoped()
  create(scope: TeamScope, file: NewHrDocument) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.employeeDocument.create({
        data: {
          organizationId: file.organizationId,
          teamId: file.teamId,
          employeeId: file.employeeId,
          documentType: file.documentType ?? file.label,
          label: file.label,
          source: "HR_UPLOADED",
          fileName: file.fileName,
          storageKey: file.storageKey,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          uploadedAt: new Date(),
        },
      });
      await this.audit.write(tx, {
        entityType: "employee_document",
        entityId: row.id,
        action: "upload_document",
        after: {
          employeeId: row.employeeId,
          documentType: auditDocumentType(row.documentType),
          source: row.source,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
        },
      });
      return row;
    });
  }

  /** Only HR-uploaded documents are removable here; the onboarding set
   * belongs to the employee's own profile flow. Returns false when nothing
   * matched (already gone, out of scope, or not HR-uploaded). */
  @TeamScoped()
  softDelete(scope: TeamScope, employeeId: number, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.employeeDocument.updateMany({
        where: teamWhere(
          scope,
          { id, employeeId, deletedAt: null, source: "HR_UPLOADED" },
          VIA_EMPLOYEE,
        ),
        data: { deletedAt: new Date() },
      });
      if (count !== 1) return false;
      await this.audit.write(tx, {
        entityType: "employee_document",
        entityId: id,
        action: "delete_document",
        before: { employeeId, source: "HR_UPLOADED" },
      });
      return true;
    });
  }

  /** Written only after the file was actually read, in its own transaction,
   * so a failed audit insert makes the caller return an error instead of the
   * file (fail-closed). */
  @TeamScoped()
  recordDownload(
    scope: TeamScope,
    doc: {
      id: number;
      employeeId: number;
      documentType: string;
      source: string;
    },
  ) {
    return this.prisma.$transaction((tx) =>
      this.audit.write(tx, {
        entityType: "employee_document",
        entityId: doc.id,
        action: "download_document",
        after: {
          employeeId: doc.employeeId,
          documentType: auditDocumentType(doc.documentType),
          source: doc.source,
        },
      }),
    );
  }
}
