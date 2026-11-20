import { Injectable } from "@nestjs/common";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { AddressDto } from "../../employee-self-service/profile/dto/address.dto.js";
import type { BankDetailsDto } from "../../employee-self-service/profile/dto/bank-details.dto.js";
import type { GovernmentIdsDto } from "../../employee-self-service/profile/dto/government-ids.dto.js";
import type { PersonalDetailsDto } from "../../employee-self-service/profile/dto/personal-details.dto.js";

export type AddressType = "PERMANENT" | "PRESENT";

/** Same audit entity as self-service edits and HR's profile edits, so one
 * employee's profile history reads as one trail; the `hr_` action tells an
 * HR edit apart. Only field NAMES are ever recorded, never a value (PAN,
 * Aadhaar, bank account, address and family details are all sensitive). */
const PROFILE_ENTITY = "employee_profile";

function comparable(value: unknown): string {
  return JSON.stringify(value instanceof Date ? value.toISOString() : value);
}

/** Names of the fields in `next` whose value differs from `before`
 * (everything when there is no previous row). */
function changedFieldNames(
  before: Record<string, unknown> | null,
  next: Record<string, unknown>,
): string[] {
  return Object.keys(next).filter(
    (key) => !before || comparable(before[key]) !== comparable(next[key]),
  );
}

interface Identity {
  organizationId: number;
  teamId: number;
  employeeId: number;
}

function addressData(dto: AddressDto) {
  return {
    addressLine: dto.addressLine,
    areaLocality: dto.areaLocality ?? null,
    district: dto.district,
    city: dto.city,
    state: dto.state,
    pincode: dto.pincode,
  };
}

/**
 * HR's write path for the same `employee_*` detail tables as self-service
 * onboarding (ProfileRepository), used once an employee's profile is
 * PROFILE_LOCKED (Docs: "ask HR to update it") and from the onboarding
 * progress view's per-section Edit action. Kept as its own repository
 * (never importing ProfileRepository — CODING_STANDARDS.md "a module's
 * `*.repository.ts` is never imported outside that module") even though the
 * shape mirrors it closely; identity is always the TARGET employee's, passed
 * in by the service after a scope-safe lookup, never derived here.
 */
@Injectable()
export class EmployeePersonalDataRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  getPersonal(employeeId: number) {
    return this.prisma.employeePersonalDetail.findUnique({
      where: { employeeId },
    });
  }

  upsertPersonal(identity: Identity, dto: PersonalDetailsDto) {
    const data = {
      dateOfBirth: new Date(dto.dateOfBirth),
      gender: dto.gender,
      maritalStatus: dto.maritalStatus ?? null,
      bloodGroup: dto.bloodGroup ?? null,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactRelation: dto.emergencyContactRelation,
      emergencyContactPhone: dto.emergencyContactPhone,
      fatherName: dto.fatherName,
      fatherPhone: dto.fatherPhone,
      motherName: dto.motherName,
      motherPhone: dto.motherPhone,
    };
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.employeePersonalDetail.findUnique({
        where: { employeeId: identity.employeeId },
      });
      const row = await tx.employeePersonalDetail.upsert({
        where: { employeeId: identity.employeeId },
        create: {
          organizationId: identity.organizationId,
          teamId: identity.teamId,
          employeeId: identity.employeeId,
          ...data,
        },
        update: data,
      });
      await this.audit.write(tx, {
        entityType: PROFILE_ENTITY,
        entityId: identity.employeeId,
        action: "hr_update_personal",
        after: {
          employeeId: identity.employeeId,
          changedFields: changedFieldNames(before, data),
        },
      });
      return row;
    });
  }

  getAddress(employeeId: number, addressType: AddressType) {
    return this.prisma.employeeAddress.findUnique({
      where: { employeeId_addressType: { employeeId, addressType } },
    });
  }

  upsertAddress(identity: Identity, addressType: AddressType, dto: AddressDto) {
    const data = addressData(dto);
    const key = {
      employeeId_addressType: {
        employeeId: identity.employeeId,
        addressType,
      },
    };
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.employeeAddress.findUnique({ where: key });
      const row = await tx.employeeAddress.upsert({
        where: key,
        create: {
          organizationId: identity.organizationId,
          teamId: identity.teamId,
          employeeId: identity.employeeId,
          addressType,
          ...data,
        },
        update: data,
      });
      await this.audit.write(tx, {
        entityType: PROFILE_ENTITY,
        entityId: identity.employeeId,
        action: "hr_update_address",
        after: {
          employeeId: identity.employeeId,
          addressType,
          changedFields: changedFieldNames(before, data),
        },
      });
      return row;
    });
  }

  getBank(employeeId: number) {
    return this.prisma.employeeBankDetail.findUnique({ where: { employeeId } });
  }

  upsertBank(
    identity: Identity,
    dto: BankDetailsDto,
    accountNumberEncrypted: string,
    accountNumberMasked: string,
  ) {
    const data = {
      accountHolderName: dto.accountHolderName,
      accountNumberEncrypted,
      accountNumberMasked,
      ifsc: dto.ifsc,
      bankName: dto.bankName,
      branchName: dto.branchName ?? null,
    };
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.employeeBankDetail.findUnique({
        where: { employeeId: identity.employeeId },
      });
      const row = await tx.employeeBankDetail.upsert({
        where: { employeeId: identity.employeeId },
        create: {
          organizationId: identity.organizationId,
          teamId: identity.teamId,
          employeeId: identity.employeeId,
          ...data,
        },
        update: data,
      });
      // The stored account number is encrypted with a fresh IV on every
      // write, so it cannot be diffed; it is always listed as submitted.
      // The masked/encrypted columns themselves are never named or logged.
      const {
        accountNumberEncrypted: _enc,
        accountNumberMasked: _mask,
        ...plain
      } = data;
      const {
        accountNumberEncrypted: _beforeEnc,
        accountNumberMasked: _beforeMask,
        ...beforePlain
      } = before ?? ({} as Record<string, unknown>);
      await this.audit.write(tx, {
        entityType: PROFILE_ENTITY,
        entityId: identity.employeeId,
        action: "hr_update_bank",
        after: {
          employeeId: identity.employeeId,
          changedFields: [
            ...changedFieldNames(before ? beforePlain : null, plain),
            "accountNumber",
          ],
        },
      });
      return row;
    });
  }

  getGovernmentIds(employeeId: number) {
    return this.prisma.employeeGovernmentId.findUnique({
      where: { employeeId },
    });
  }

  upsertGovernmentIds(identity: Identity, dto: GovernmentIdsDto) {
    const data = {
      aadhaarNumber: dto.aadhaarNumber,
      panNumber: dto.panNumber,
      esiNumber: dto.esiNumber ?? null,
      pfNumber: dto.pfNumber ?? null,
    };
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.employeeGovernmentId.findUnique({
        where: { employeeId: identity.employeeId },
      });
      const row = await tx.employeeGovernmentId.upsert({
        where: { employeeId: identity.employeeId },
        create: {
          organizationId: identity.organizationId,
          teamId: identity.teamId,
          employeeId: identity.employeeId,
          ...data,
        },
        update: data,
      });
      await this.audit.write(tx, {
        entityType: PROFILE_ENTITY,
        entityId: identity.employeeId,
        action: "hr_update_government_ids",
        after: {
          employeeId: identity.employeeId,
          changedFields: changedFieldNames(before, data),
        },
      });
      return row;
    });
  }

  getDocument(employeeId: number, documentType: string) {
    return this.prisma.employeeDocument.findFirst({
      where: { employeeId, documentType, source: "ONBOARDING" },
    });
  }

  async upsertDocumentFile(
    identity: Identity,
    documentType: string,
    file: {
      fileName: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
    },
  ) {
    const data = { ...file, uploadedAt: new Date(), deletedAt: null };
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.employeeDocument.findFirst({
        where: {
          employeeId: identity.employeeId,
          documentType,
          source: "ONBOARDING",
        },
      });
      const row = existing
        ? await tx.employeeDocument.update({
            where: { id: existing.id },
            data,
          })
        : await tx.employeeDocument.create({
            data: {
              organizationId: identity.organizationId,
              teamId: identity.teamId,
              employeeId: identity.employeeId,
              documentType,
              source: "ONBOARDING",
              ...data,
            },
          });
      // Type and size class only: not the file name or contents.
      await this.audit.write(tx, {
        entityType: "employee_document",
        entityId: row.id,
        action: "hr_upload_document",
        after: {
          employeeId: identity.employeeId,
          documentType,
          source: "ONBOARDING",
          replaced: existing !== null,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
        },
      });
      return row;
    });
  }
}
