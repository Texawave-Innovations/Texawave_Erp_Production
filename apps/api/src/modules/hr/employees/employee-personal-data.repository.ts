import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { AddressDto } from "../../employee-self-service/profile/dto/address.dto.js";
import type { BankDetailsDto } from "../../employee-self-service/profile/dto/bank-details.dto.js";
import type { GovernmentIdsDto } from "../../employee-self-service/profile/dto/government-ids.dto.js";
import type { PersonalDetailsDto } from "../../employee-self-service/profile/dto/personal-details.dto.js";

export type AddressType = "PERMANENT" | "PRESENT";

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
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.employeePersonalDetail.upsert({
      where: { employeeId: identity.employeeId },
      create: {
        organizationId: identity.organizationId,
        teamId: identity.teamId,
        employeeId: identity.employeeId,
        ...data,
      },
      update: data,
    });
  }

  getAddress(employeeId: number, addressType: AddressType) {
    return this.prisma.employeeAddress.findUnique({
      where: { employeeId_addressType: { employeeId, addressType } },
    });
  }

  upsertAddress(identity: Identity, addressType: AddressType, dto: AddressDto) {
    const data = addressData(dto);
    return this.prisma.employeeAddress.upsert({
      where: {
        employeeId_addressType: {
          employeeId: identity.employeeId,
          addressType,
        },
      },
      create: {
        organizationId: identity.organizationId,
        teamId: identity.teamId,
        employeeId: identity.employeeId,
        addressType,
        ...data,
      },
      update: data,
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
    return this.prisma.employeeBankDetail.upsert({
      where: { employeeId: identity.employeeId },
      create: {
        organizationId: identity.organizationId,
        teamId: identity.teamId,
        employeeId: identity.employeeId,
        ...data,
      },
      update: data,
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
    return this.prisma.employeeGovernmentId.upsert({
      where: { employeeId: identity.employeeId },
      create: {
        organizationId: identity.organizationId,
        teamId: identity.teamId,
        employeeId: identity.employeeId,
        ...data,
      },
      update: data,
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
    const existing = await this.getDocument(identity.employeeId, documentType);
    if (existing) {
      return this.prisma.employeeDocument.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.employeeDocument.create({
      data: {
        organizationId: identity.organizationId,
        teamId: identity.teamId,
        employeeId: identity.employeeId,
        documentType,
        source: "ONBOARDING",
        ...data,
      },
    });
  }
}
