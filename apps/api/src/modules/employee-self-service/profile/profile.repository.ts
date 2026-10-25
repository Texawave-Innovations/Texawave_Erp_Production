import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { classifyDbError } from "../../../common/database/db-errors.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { lockEmployee } from "../../hr/employees/employee-lock.js";
import type { AddressDto } from "./dto/address.dto.js";
import type { BankDetailsDto } from "./dto/bank-details.dto.js";
import type { ExperienceDto } from "./dto/experience.dto.js";
import type { FamilyMemberDto } from "./dto/family-member.dto.js";
import type { GovernmentIdsDto } from "./dto/government-ids.dto.js";
import type { PersonalDetailsDto } from "./dto/personal-details.dto.js";
import type { SelfProfileUpdateDto } from "./dto/self-profile-update.dto.js";

export type AddressType = "PERMANENT" | "PRESENT";

interface Identity {
  organizationId: number;
  teamId: number;
  employeeId: number;
}

/** Same audit entity as HR's profile edits (hr/profiles/profiles.repository.ts),
 * so one employee's profile history reads as one trail; the action tells a
 * self-edit apart from an HR edit. */
const PROFILE_ENTITY = "employee_profile";

/** Personal-detail columns named in a self-edit (only the keys sent). */
function selfPersonalData(
  dto: SelfProfileUpdateDto,
): Prisma.EmployeePersonalDetailUncheckedUpdateInput {
  const data: Prisma.EmployeePersonalDetailUncheckedUpdateInput = {};
  if (dto.dateOfBirth !== undefined)
    data.dateOfBirth = new Date(dto.dateOfBirth);
  if (dto.gender !== undefined) data.gender = dto.gender;
  if (dto.maritalStatus !== undefined)
    data.maritalStatus = dto.maritalStatus ?? null;
  if (dto.bloodGroup !== undefined) data.bloodGroup = dto.bloodGroup ?? null;
  for (const key of [
    "emergencyContactName",
    "emergencyContactRelation",
    "emergencyContactPhone",
    "fatherName",
    "fatherPhone",
    "motherName",
    "motherPhone",
  ] as const) {
    if (dto[key] !== undefined) data[key] = dto[key];
  }
  return data;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  /**
   * The employee's own post-onboarding edit (PATCH employee/profile): full
   * name (mirrored to the linked user's display name), phone and referred-by
   * on the employee row, personal details, and addresses —
   * one transaction under the employee row lock, with one audit row naming
   * the changed fields (never their values; same rule as HR's profile audit).
   * Touching the employee row bumps its optimistic-lock `version`, so an HR
   * edit made against the old version gets a 409 instead of overwriting.
   */
  async selfUpdate(
    identity: Identity,
    dto: SelfProfileUpdateDto,
    actorUserId: number,
    changedFields: string[],
  ): Promise<void> {
    const { employeeId } = identity;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (!(await lockEmployee(tx, identity.organizationId, employeeId))) {
          throw new ResourceNotFoundException("Employee", employeeId);
        }

        const employeeData: Prisma.EmployeeUncheckedUpdateInput = {};
        if (dto.fullName !== undefined) employeeData.fullName = dto.fullName;
        if (dto.phone !== undefined) employeeData.phone = dto.phone;
        if (dto.referredBy !== undefined)
          employeeData.referredBy = dto.referredBy?.trim() || null;
        if (Object.keys(employeeData).length > 0) {
          const updated = await tx.employee.update({
            where: { id: employeeId },
            data: {
              ...employeeData,
              version: { increment: 1 },
              updatedBy: actorUserId,
            },
            select: { userId: true },
          });
          // Legacy synced the name to the portal user record too
          // (users/{key}.name), so the header/menus show the new name. Only
          // the display name — never the login e-mail or credentials.
          if (dto.fullName !== undefined && updated.userId !== null) {
            await tx.user.updateMany({
              where: {
                id: updated.userId,
                organizationId: identity.organizationId,
              },
              data: { fullName: dto.fullName },
            });
          }
        }

        const personal = selfPersonalData(dto);
        if (Object.keys(personal).length > 0) {
          await tx.employeePersonalDetail.upsert({
            where: { employeeId },
            create: {
              ...(personal as Prisma.EmployeePersonalDetailUncheckedCreateInput),
              ...identity,
              createdBy: actorUserId,
              updatedBy: actorUserId,
            },
            update: { ...personal, updatedBy: actorUserId },
          });
        }

        for (const [addressType, value] of [
          ["PERMANENT", dto.permanentAddress],
          ["PRESENT", dto.presentAddress],
        ] as const) {
          if (value === undefined) continue;
          if (value === null) {
            // No PRESENT row means "same as permanent" (the wizard's convention).
            await tx.employeeAddress.deleteMany({
              where: { employeeId, addressType },
            });
            continue;
          }
          await tx.employeeAddress.upsert({
            where: { employeeId_addressType: { employeeId, addressType } },
            create: {
              ...identity,
              addressType,
              ...addressData(value),
              createdBy: actorUserId,
              updatedBy: actorUserId,
            },
            update: {
              ...addressData(value),
              deletedAt: null,
              updatedBy: actorUserId,
            },
          });
        }

        await this.audit.write(tx, {
          entityType: PROFILE_ENTITY,
          entityId: employeeId,
          action: "self_update",
          after: { employeeId, changedFields },
        });
      });
    } catch (error) {
      // The per-organization phone index (employees_org_phone_digits_key) —
      // same mapping as hr/employees' update.
      const violation = classifyDbError(error);
      const where = [
        ...(violation?.columns ?? []),
        violation?.constraint ?? "",
        (error as { message?: string }).message ?? "",
      ].join(",");
      if (violation?.kind === "unique" && where.includes("phone")) {
        throw new ResourceConflictException(
          "Another employee already has this phone number",
        );
      }
      throw error;
    }
  }

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
      where: { employeeId, source: "ONBOARDING", deletedAt: null },
      orderBy: { documentType: "asc" },
    });
  }

  /** Includes soft-deleted rows: a re-upload must reuse the same row (see
   * upsertDocumentFile). Onboarding's one-row-per-type guarantee is a
   * partial unique index scoped to source="ONBOARDING" (see schema.prisma's
   * comment on EmployeeDocument), so there is no compound-key shorthand to
   * query by here — filter explicitly instead. */
  getDocument(employeeId: number, documentType: string) {
    return this.prisma.employeeDocument.findFirst({
      where: { employeeId, documentType, source: "ONBOARDING" },
    });
  }

  /** One row per documentType among source="ONBOARDING" rows: a re-upload
   * replaces the file and clears any earlier soft delete. No DB-level
   * compound unique key exists to upsert against (see getDocument), so this
   * does the find-then-create/update explicitly. */
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

  removeDocument(employeeId: number, documentType: string) {
    return this.prisma.employeeDocument.updateMany({
      where: {
        employeeId,
        documentType,
        source: "ONBOARDING",
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }
}
