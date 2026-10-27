import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { FieldEncryptionService } from "../../../shared/crypto/field-encryption.service.js";
import {
  detectFileType,
  FileStorageService,
  MAX_UPLOAD_BYTES,
} from "../../../shared/file-storage/file-storage.service.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import type { AddressDto } from "../../employee-self-service/profile/dto/address.dto.js";
import type { BankDetailsDto } from "../../employee-self-service/profile/dto/bank-details.dto.js";
import {
  DOCUMENT_TYPES,
  isDocumentType,
} from "../../employee-self-service/profile/dto/onboarding-rules.js";
import type { GovernmentIdsDto } from "../../employee-self-service/profile/dto/government-ids.dto.js";
import type { PersonalDetailsDto } from "../../employee-self-service/profile/dto/personal-details.dto.js";
import { asGovernmentIdConflict } from "../../employee-self-service/profile/government-id-conflict.js";
import {
  type AddressType,
  EmployeePersonalDataRepository,
} from "./employee-personal-data.repository.js";
import { EmployeesRepository } from "./employees.repository.js";

const WRITE = "hr.employee.write";
const READ = "hr.employee.read";

export interface UploadedDocument {
  buffer: Buffer;
  size: number;
  originalname: string;
}

function sanitizeFileName(name: string): string {
  const base = [...path.basename(name)]
    .filter((char) => char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) !== 0x7f)
    .join("")
    .trim();
  return (base || "document").slice(0, 255);
}

const ADDRESS_TYPES: readonly AddressType[] = ["PERMANENT", "PRESENT"];

/**
 * HR's edit of an employee's own-profile tables (personal details, address,
 * bank, government IDs, onboarding documents) — the path the self-service
 * `ProfileService` points to once a profile is PROFILE_LOCKED after
 * onboarding ("Ask HR to update it"), and what the onboarding progress
 * view's per-section Edit action calls. Every method re-checks the caller's
 * `hr.employee.write`/`.read` team scope against the TARGET employee via
 * `EmployeesRepository.findOne`, the same scope-safe lookup `EmployeesService`
 * uses — never trusts an employeeId without it.
 */
@Injectable()
export class EmployeePersonalDataService {
  constructor(
    private readonly employees: EmployeesRepository,
    private readonly repository: EmployeePersonalDataRepository,
    private readonly teamContext: TeamContextService,
    private readonly encryption: FieldEncryptionService,
    private readonly files: FileStorageService,
  ) {}

  private async identityFor(id: number, permission: string) {
    const scope = await this.teamContext.resolveScope(permission);
    const employee = await this.employees.findOne(scope, id);
    if (!employee) throw new ResourceNotFoundException("Employee", id);
    return {
      organizationId: employee.organizationId,
      teamId: employee.teamId,
      employeeId: employee.id,
    };
  }

  async getPersonal(id: number) {
    const { employeeId } = await this.identityFor(id, READ);
    return this.repository.getPersonal(employeeId);
  }

  async updatePersonal(id: number, dto: PersonalDetailsDto) {
    const identity = await this.identityFor(id, WRITE);
    return this.repository.upsertPersonal(identity, dto);
  }

  private assertAddressType(
    addressType: string,
  ): asserts addressType is AddressType {
    if (!ADDRESS_TYPES.includes(addressType as AddressType)) {
      throw new BadRequestException(
        `addressType must be one of ${ADDRESS_TYPES.join(", ")}`,
      );
    }
  }

  async getAddress(id: number, addressType: string) {
    this.assertAddressType(addressType);
    const { employeeId } = await this.identityFor(id, READ);
    return this.repository.getAddress(employeeId, addressType);
  }

  async updateAddress(id: number, addressType: string, dto: AddressDto) {
    this.assertAddressType(addressType);
    const identity = await this.identityFor(id, WRITE);
    return this.repository.upsertAddress(identity, addressType, dto);
  }

  async getBank(id: number) {
    const { employeeId } = await this.identityFor(id, READ);
    const row = await this.repository.getBank(employeeId);
    if (!row) return null;
    const { accountNumberEncrypted: _omit, ...rest } = row;
    return rest;
  }

  async updateBank(id: number, dto: BankDetailsDto) {
    const identity = await this.identityFor(id, WRITE);
    const encrypted = this.encryption.encrypt(dto.accountNumber);
    const masked = this.encryption.mask(dto.accountNumber);
    const row = await this.repository.upsertBank(
      identity,
      dto,
      encrypted,
      masked,
    );
    const { accountNumberEncrypted: _omit, ...rest } = row;
    return rest;
  }

  async getGovernmentIds(id: number) {
    const { employeeId } = await this.identityFor(id, READ);
    return this.repository.getGovernmentIds(employeeId);
  }

  async updateGovernmentIds(id: number, dto: GovernmentIdsDto) {
    const identity = await this.identityFor(id, WRITE);
    try {
      return await this.repository.upsertGovernmentIds(identity, dto);
    } catch (error) {
      throw asGovernmentIdConflict(error);
    }
  }

  async uploadDocument(
    id: number,
    documentType: string,
    file: UploadedDocument | undefined,
  ) {
    if (!isDocumentType(documentType)) {
      throw new BadRequestException(
        `documentType must be one of ${DOCUMENT_TYPES.join(", ")}`,
      );
    }
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

    const identity = await this.identityFor(id, WRITE);
    const previous = await this.repository.getDocument(
      identity.employeeId,
      documentType,
    );
    const storageKey = `${identity.employeeId}/${documentType}/${randomUUID()}.${detected.extension}`;

    await this.files.save(storageKey, file.buffer);
    let row;
    try {
      row = await this.repository.upsertDocumentFile(identity, documentType, {
        fileName: sanitizeFileName(file.originalname),
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: file.size,
      });
    } catch (error) {
      await this.files.remove(storageKey);
      throw error;
    }
    if (previous?.storageKey && previous.storageKey !== storageKey) {
      await this.files.remove(previous.storageKey);
    }
    const { storageKey: _omit, ...metadata } = row;
    return metadata;
  }
}
