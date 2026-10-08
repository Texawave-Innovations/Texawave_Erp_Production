import { Injectable } from "@nestjs/common";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import {
  teamWhere,
  type TeamWhereFields,
} from "../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

/** employee_documents carries teamId directly, but owner (self) access runs
 * through the employee's user, not a column on this table. */
const VIA_EMPLOYEE: TeamWhereFields = { ownerField: "employee.userId" };

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
  constructor(private readonly prisma: PrismaService) {}

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
  @TeamScoped()
  create(scope: TeamScope, file: NewHrDocument) {
    return this.prisma.employeeDocument.create({
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
  }

  @TeamScoped()
  softDelete(scope: TeamScope, employeeId: number, id: number) {
    return this.prisma.employeeDocument.updateMany({
      where: teamWhere(
        scope,
        { id, employeeId, deletedAt: null },
        VIA_EMPLOYEE,
      ),
      data: { deletedAt: new Date() },
    });
  }
}
