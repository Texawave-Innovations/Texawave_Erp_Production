import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { AddressDto } from "./dto/address.dto.js";
import type { BankDetailsDto } from "./dto/bank-details.dto.js";
import type { ExperienceDto } from "./dto/experience.dto.js";
import type { FamilyMemberDto } from "./dto/family-member.dto.js";
import type { GovernmentIdsDto } from "./dto/government-ids.dto.js";
import type { PersonalDetailsDto } from "./dto/personal-details.dto.js";

export type AddressType = "PERMANENT" | "PRESENT";

interface Identity {
  organizationId: number;
  teamId: number;
  employeeId: number;
}

/**
 * The only place PrismaService is called for self-service onboarding writes.
 * Every method is keyed by `employeeId`, which the SERVICE resolves from the
 * authenticated user (EmployeeQueryService.getCurrentEmployee()) — never
 * accepted from the request. There is no cross-employee read path here by
 * construction, so these methods do not carry @TeamScoped(): that decorator
 * guards methods that take a caller-supplied scope level, which does not
 * apply when the row is already pinned to the caller's own employeeId.
 */
@Injectable()
export class ProfileRepository {
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
    const data = {
      addressLine: dto.addressLine,
      areaLocality: dto.areaLocality ?? null,
      district: dto.district,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
    };
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

  /** Called when the employee ticks "present address same as permanent". */
  deleteAddress(employeeId: number, addressType: AddressType) {
    return this.prisma.employeeAddress.deleteMany({
      where: { employeeId, addressType },
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

  listFamilyMembers(employeeId: number) {
    return this.prisma.employeeFamilyMember.findMany({
      where: { employeeId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  addFamilyMember(identity: Identity, dto: FamilyMemberDto) {
    return this.prisma.employeeFamilyMember.create({
      data: {
        organizationId: identity.organizationId,
        teamId: identity.teamId,
        employeeId: identity.employeeId,
        name: dto.name,
        relation: dto.relation,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        contactPhone: dto.contactPhone ?? null,
      },
    });
  }

  updateFamilyMember(employeeId: number, id: number, dto: FamilyMemberDto) {
    return this.prisma.employeeFamilyMember.updateMany({
      where: { id, employeeId, deletedAt: null },
      data: {
        name: dto.name,
        relation: dto.relation,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        contactPhone: dto.contactPhone ?? null,
      },
    });
  }

  removeFamilyMember(employeeId: number, id: number) {
    return this.prisma.employeeFamilyMember.updateMany({
      where: { id, employeeId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  listExperience(employeeId: number) {
    return this.prisma.employeeExperience.findMany({
      where: { employeeId, deletedAt: null },
      orderBy: { fromDate: "asc" },
    });
  }

  addExperience(identity: Identity, dto: ExperienceDto) {
    return this.prisma.employeeExperience.create({
      data: {
        organizationId: identity.organizationId,
        teamId: identity.teamId,
        employeeId: identity.employeeId,
        employer: dto.employer,
        designation: dto.designation,
        fromDate: new Date(dto.fromDate),
        toDate: dto.toDate ? new Date(dto.toDate) : null,
        reasonForLeaving: dto.reasonForLeaving ?? null,
      },
    });
  }

  updateExperience(employeeId: number, id: number, dto: ExperienceDto) {
    return this.prisma.employeeExperience.updateMany({
      where: { id, employeeId, deletedAt: null },
      data: {
        employer: dto.employer,
        designation: dto.designation,
        fromDate: new Date(dto.fromDate),
        toDate: dto.toDate ? new Date(dto.toDate) : null,
        reasonForLeaving: dto.reasonForLeaving ?? null,
      },
    });
  }

  removeExperience(employeeId: number, id: number) {
    return this.prisma.employeeExperience.updateMany({
      where: { id, employeeId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  listDocuments(employeeId: number) {
    return this.prisma.employeeDocument.findMany({
      where: { employeeId, deletedAt: null },
      orderBy: { documentType: "asc" },
    });
  }

  /** Includes soft-deleted rows: the unique key covers them too, so a
   * re-upload must reuse the same row (see upsertDocumentFile). */
  getDocument(employeeId: number, documentType: string) {
    return this.prisma.employeeDocument.findUnique({
      where: { employeeId_documentType: { employeeId, documentType } },
    });
  }

  /** One row per documentType: a re-upload replaces the file and clears any
   * earlier soft delete. */
  upsertDocumentFile(
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
    return this.prisma.employeeDocument.upsert({
      where: {
        employeeId_documentType: {
          employeeId: identity.employeeId,
          documentType,
        },
      },
      create: {
        organizationId: identity.organizationId,
        teamId: identity.teamId,
        employeeId: identity.employeeId,
        documentType,
        ...data,
      },
      update: data,
    });
  }

  removeDocument(employeeId: number, documentType: string) {
    return this.prisma.employeeDocument.updateMany({
      where: { employeeId, documentType, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
