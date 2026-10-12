import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import {
  detectFileType,
  FileStorageService,
  MAX_UPLOAD_BYTES,
} from "../../../shared/file-storage/file-storage.service.js";
import { EmployeesService } from "../employees/employees.service.js";
import { EmployeeDocumentsRepository } from "./employee-documents.repository.js";

const READ = "hr.employee_document.read";
const WRITE = "hr.employee_document.write";

export interface UploadedDocument {
  buffer: Buffer;
  size: number;
  originalname: string;
}

/** Keeps the uploader's own file name for display, minus any path or control
 * characters — copied from profile.service.ts's sanitizeFileName. */
function sanitizeFileName(name: string): string {
  const base = [...path.basename(name)]
    .filter((char) => char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) !== 0x7f)
    .join("")
    .trim();
  return (base || "document").slice(0, 255);
}

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private readonly repository: EmployeeDocumentsRepository,
    private readonly employees: EmployeesService,
    private readonly teamContext: TeamContextService,
    private readonly files: FileStorageService,
  ) {}

  /** Resolves scope and confirms the employee is within it — out-of-scope
   * ids 404 rather than 403, matching hr-onboarding.controller.ts's note on
   * not disclosing records the caller may not see. */
  private async resolveTarget(employeeId: number, permission: string) {
    const scope = await this.teamContext.resolveScope(permission);
    const employee = await this.employees.findOne(employeeId);
    return { scope, employee };
  }

  /** Never returns the internal storage key. */
  async listDocuments(employeeId: number) {
    const { scope } = await this.resolveTarget(employeeId, READ);
    const rows = await this.repository.list(scope, employeeId);
    return rows.map(({ storageKey: _omit, ...rest }) => rest);
  }

  async uploadDocument(
    employeeId: number,
    dto: { label: string; documentType?: string },
    file: UploadedDocument | undefined,
  ) {
    if (!file) throw new BadRequestException("Choose a file to upload.");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException("File must be 5 MB or smaller.");
    }
    const detected = detectFileType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        "Only PDF, JPG, or PNG files are accepted.",
      );
    }

    const { scope, employee } = await this.resolveTarget(employeeId, WRITE);
    const storageKey = `${employeeId}/hr/${randomUUID()}.${detected.extension}`;

    await this.files.save(storageKey, file.buffer);
    try {
      const row = await this.repository.create(scope, {
        organizationId: scope.organizationId,
        teamId: employee.team.id,
        employeeId,
        label: dto.label,
        documentType: dto.documentType ?? null,
        fileName: sanitizeFileName(file.originalname),
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: file.size,
      });
      const { storageKey: _omit, ...metadata } = row;
      return metadata;
    } catch (error) {
      await this.files.remove(storageKey);
      throw error;
    }
  }

  async downloadDocument(employeeId: number, id: number) {
    const { scope } = await this.resolveTarget(employeeId, READ);
    const row = await this.repository.getById(scope, employeeId, id);
    if (!row || row.deletedAt || !row.storageKey) {
      throw new ResourceNotFoundException("Document", id);
    }
    return {
      buffer: await this.files.read(row.storageKey),
      mimeType: row.mimeType ?? "application/octet-stream",
      fileName: row.fileName,
    };
  }

  async removeDocument(employeeId: number, id: number) {
    const { scope } = await this.resolveTarget(employeeId, WRITE);
    const row = await this.repository.getById(scope, employeeId, id);
    if (!row || row.deletedAt) {
      throw new ResourceNotFoundException("Document", id);
    }
    await this.repository.softDelete(scope, employeeId, id);
    if (row.storageKey) await this.files.remove(row.storageKey);
  }
}
