import { BadRequestException, Injectable } from "@nestjs/common";
import { FieldEncryptionService } from "../../../shared/crypto/field-encryption.service.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { UserLoginStateService } from "../../../platform/users/user-login-state.service.js";
import { EmployeeQueryService } from "../../hr/employees/employee-query.service.js";
import type { AddressDto } from "./dto/address.dto.js";
import type { BankDetailsDto } from "./dto/bank-details.dto.js";
import {
  detectFileType,
  FileStorageService,
  MAX_UPLOAD_BYTES,
} from "../../../shared/file-storage/file-storage.service.js";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DOCUMENT_TYPES, isDocumentType } from "./dto/onboarding-rules.js";

export interface UploadedDocument {
  buffer: Buffer;
  size: number;
  originalname: string;
}

/** Keeps the employee's own file name for display, minus any path or control characters. */
function sanitizeFileName(name: string): string {
  const base = [...path.basename(name)]
    .filter((char) => char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) !== 0x7f)
    .join("")
    .trim();
  return (base || "document").slice(0, 255);
}
import type { ExperienceDto } from "./dto/experience.dto.js";
import type { FamilyMemberDto } from "./dto/family-member.dto.js";
import type { GovernmentIdsDto } from "./dto/government-ids.dto.js";
import type { PersonalDetailsDto } from "./dto/personal-details.dto.js";
import { OnboardingProgressService } from "./onboarding-progress.service.js";
import { ProfileRepository, type AddressType } from "./profile.repository.js";

export const ADDRESS_TYPES: readonly AddressType[] = ["PERMANENT", "PRESENT"];

/** Employee self-service reads AND writes. Every method resolves "who am I"
 * from the authenticated user via the employee↔user mapping — there is no
 * employee id anywhere in the request, so nobody can touch someone else's
 * record (Docs/ARCHITECTURE.md §7). */
@Injectable()
export class ProfileService {
  constructor(
    private readonly employees: EmployeeQueryService,
    private readonly tenantContext: TenantContextService,
    private readonly repository: ProfileRepository,
    private readonly encryption: FieldEncryptionService,
    private readonly loginState: UserLoginStateService,
    private readonly files: FileStorageService,
    private readonly progress: OnboardingProgressService,
  ) {}

  getMyProfile() {
    return this.employees.getCurrentEmployee();
  }

  private async currentIdentity() {
    const employee = await this.employees.getCurrentEmployee();
    return {
      organizationId: this.tenantContext.getOrgScope().organizationId,
      teamId: employee.team.id,
      employeeId: employee.id,
    };
  }

  async getPersonal() {
    const { employeeId } = await this.currentIdentity();
    return this.repository.getPersonal(employeeId);
  }

  async putPersonal(dto: PersonalDetailsDto) {
    const identity = await this.currentIdentity();
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

  async getAddress(addressType: string) {
    this.assertAddressType(addressType);
    const { employeeId } = await this.currentIdentity();
    return this.repository.getAddress(employeeId, addressType);
  }

  async putAddress(addressType: string, dto: AddressDto) {
    this.assertAddressType(addressType);
    const identity = await this.currentIdentity();
    return this.repository.upsertAddress(identity, addressType, dto);
  }

  /** "Present address same as permanent" — clears any stored present
   * address so completeness treats it as not required (Docs decision). */
  async clearPresentAddress() {
    const { employeeId } = await this.currentIdentity();
    await this.repository.deleteAddress(employeeId, "PRESENT");
  }

  async getBank() {
    const { employeeId } = await this.currentIdentity();
    const row = await this.repository.getBank(employeeId);
    if (!row) return null;
    // Own-record read still only ever returns the masked number — full
    // reveal is a separate, audited HR permission, not a self-service concern.
    const { accountNumberEncrypted: _omit, ...rest } = row;
    return rest;
  }

  async putBank(dto: BankDetailsDto) {
    const identity = await this.currentIdentity();
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

  async getGovernmentIds() {
    const { employeeId } = await this.currentIdentity();
    return this.repository.getGovernmentIds(employeeId);
  }

  async putGovernmentIds(dto: GovernmentIdsDto) {
    const identity = await this.currentIdentity();
    return this.repository.upsertGovernmentIds(identity, dto);
  }

  async listFamilyMembers() {
    const { employeeId } = await this.currentIdentity();
    return this.repository.listFamilyMembers(employeeId);
  }

  async addFamilyMember(dto: FamilyMemberDto) {
    const identity = await this.currentIdentity();
    return this.repository.addFamilyMember(identity, dto);
  }

  async updateFamilyMember(id: number, dto: FamilyMemberDto) {
    const { employeeId } = await this.currentIdentity();
    const result = await this.repository.updateFamilyMember(
      employeeId,
      id,
      dto,
    );
    if (result.count === 0)
      throw new ResourceNotFoundException("Family member", id);
  }

  async removeFamilyMember(id: number) {
    const { employeeId } = await this.currentIdentity();
    const result = await this.repository.removeFamilyMember(employeeId, id);
    if (result.count === 0)
      throw new ResourceNotFoundException("Family member", id);
  }

  async listExperience() {
    const { employeeId } = await this.currentIdentity();
    return this.repository.listExperience(employeeId);
  }

  async addExperience(dto: ExperienceDto) {
    const identity = await this.currentIdentity();
    return this.repository.addExperience(identity, dto);
  }

  async updateExperience(id: number, dto: ExperienceDto) {
    const { employeeId } = await this.currentIdentity();
    const result = await this.repository.updateExperience(employeeId, id, dto);
    if (result.count === 0)
      throw new ResourceNotFoundException("Experience", id);
  }

  async removeExperience(id: number) {
    const { employeeId } = await this.currentIdentity();
    const result = await this.repository.removeExperience(employeeId, id);
    if (result.count === 0)
      throw new ResourceNotFoundException("Experience", id);
  }

  /** Never returns the internal storage key. */
  async listDocuments() {
    const { employeeId } = await this.currentIdentity();
    const rows = await this.repository.listDocuments(employeeId);
    return rows.map(({ storageKey: _omit, ...rest }) => rest);
  }

  async uploadDocument(
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

    const identity = await this.currentIdentity();
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

  async downloadDocument(documentType: string) {
    const { employeeId } = await this.currentIdentity();
    const row = await this.repository.getDocument(employeeId, documentType);
    if (!row || row.deletedAt || !row.storageKey) {
      throw new ResourceNotFoundException("Document", documentType);
    }
    return {
      buffer: await this.files.read(row.storageKey),
      mimeType: row.mimeType ?? "application/octet-stream",
      fileName: row.fileName,
    };
  }

  async removeDocument(documentType: string) {
    const { employeeId } = await this.currentIdentity();
    const row = await this.repository.getDocument(employeeId, documentType);
    if (!row || row.deletedAt) {
      throw new ResourceNotFoundException("Document", documentType);
    }
    await this.repository.removeDocument(employeeId, documentType);
    if (row.storageKey) await this.files.remove(row.storageKey);
  }

  /** Returns the missing-items list when incomplete; completes onboarding
   * and returns an empty list when every required item is present. */
  async submit(): Promise<{ missing: string[] }> {
    // The real gate is the login flag, not `onboardingStatus` — the stored
    // column only ever holds PENDING_ACTIVATION or COMPLETE (Docs/ARCHITECTURE.md
    // §7); it cannot tell "still on temp password" apart from "password
    // changed, profile incomplete" the way `User.mustChangePassword` can.
    if (await this.loginState.currentUserMustChangePassword()) {
      throw new BusinessRuleViolationException(
        "Change your temporary password before submitting your profile",
        "PASSWORD_CHANGE_REQUIRED",
      );
    }

    const { employeeId } = await this.currentIdentity();
    const missing = await this.progress.missingFor(employeeId);

    if (missing.length > 0) {
      return { missing };
    }

    await this.employees.completeOnboarding();
    return { missing: [] };
  }
}
