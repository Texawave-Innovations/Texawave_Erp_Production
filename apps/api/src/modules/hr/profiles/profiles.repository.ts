import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { changedFieldNames } from "./profiles.rules.js";

const PROFILE_ENTITY = "employee_profile";
const SENSITIVE_ENTITY = "employee_sensitive_info";

export interface AddressValue {
  address: string;
  area?: string | undefined;
  district?: string | undefined;
  city: string;
  state: string;
  pincode: string;
  country?: string | undefined;
}

/** Already normalised by the service; only the keys the request named appear. */
export type ProfilePatch = Partial<{
  title: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  maritalStatus: string | null;
  bloodGroup: string | null;
  languages: string[];
  fatherName: string | null;
  motherName: string | null;
  spouseName: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  presentAddress: AddressValue | null;
  permanentAddress: AddressValue | null;
  isFresher: boolean;
  experienceYears: string | null;
  previousCompany: string | null;
  previousRole: string | null;
}>;

/** Identifiers as entered; the bank account already encrypted by the service. */
export type SensitivePatch = Partial<{
  panNumber: string | null;
  aadhaarNumber: string | null;
  esiNumber: string | null;
  pfNumber: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankIfsc: string | null;
  bankAccount: { encrypted: string; masked: string } | null;
}>;

/** Employee summary shown beside the profile. Only the fields HR already holds. */
const EMPLOYEE_SELECT = {
  id: true,
  employeeCode: true,
  fullName: true,
  workEmail: true,
  phone: true,
  dateOfJoining: true,
  status: true,
  userId: true,
  teamId: true,
} satisfies Prisma.EmployeeSelect;

/** What a profile read loads: the personal-details row and both addresses. */
const PROFILE_SELECT = {
  ...EMPLOYEE_SELECT,
  personalDetail: true,
  employeeAddresses: { where: { deletedAt: null } },
  documents: {
    where: { documentType: "PROFILE_PHOTO", isActive: true },
    select: { id: true, fileName: true, mimeType: true },
    orderBy: { uploadedAt: "desc" },
    take: 1,
  },
} satisfies Prisma.EmployeeSelect;

type ProfileRow = Prisma.EmployeeGetPayload<{ select: typeof PROFILE_SELECT }>;
type AddressRow = ProfileRow["employeeAddresses"][number];

/** Team/owner routing for an employee row (the row IS the employee). */
const OWN_TEAM = { teamField: "teamId", ownerField: "userId" };

function toAddressValue(row: AddressRow | undefined): AddressValue | null {
  if (!row) return null;
  return {
    address: row.addressLine,
    ...(row.areaLocality ? { area: row.areaLocality } : {}),
    ...(row.district ? { district: row.district } : {}),
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    ...(row.country ? { country: row.country } : {}),
  };
}

/**
 * The HR profile response. Its shape is unchanged from when the profile had
 * its own table; it is now assembled from `employee_personal_details` and
 * `employee_addresses`, the same rows the onboarding wizard writes.
 */
export function toProfileView(row: ProfileRow) {
  const p = row.personalDetail;
  const photoDoc = row.documents?.[0];
  const address = (type: string) =>
    toAddressValue(row.employeeAddresses.find((a) => a.addressType === type));
  return {
    employee: {
      id: row.id,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      workEmail: row.workEmail,
      phone: row.phone,
      dateOfJoining: formatDateOnly(row.dateOfJoining),
      status: row.status,
      avatarUrl: photoDoc
        ? `/hr/employees/${row.id}/documents/${photoDoc.id}/file`
        : null,
    },
    profile: {
      title: p?.title ?? null,
      dateOfBirth: p?.dateOfBirth ? formatDateOnly(p.dateOfBirth) : null,
      gender: p?.gender ?? null,
      maritalStatus: p?.maritalStatus ?? null,
      bloodGroup: p?.bloodGroup ?? null,
      languages: p?.languages ?? [],
      fatherName: p?.fatherName ?? null,
      motherName: p?.motherName ?? null,
      spouseName: p?.spouseName ?? null,
      emergencyContact: {
        name: p?.emergencyContactName ?? null,
        phone: p?.emergencyContactPhone ?? null,
        relation: p?.emergencyContactRelation ?? null,
      },
      presentAddress: address("PRESENT"),
      permanentAddress: address("PERMANENT"),
      isFresher: p?.isFresher ?? false,
      experienceYears: p?.experienceYears
        ? Number(p.experienceYears.toFixed(1))
        : null,
      previousCompany: p?.previousCompany ?? null,
      previousRole: p?.previousRole ?? null,
      updatedAt: p?.updatedAt ?? null,
    },
  };
}

export function toSensitiveView(
  employeeId: number,
  ids: {
    panNumber: string | null;
    aadhaarNumber: string | null;
    esiNumber: string | null;
    pfNumber: string | null;
    updatedAt: Date;
  } | null,
  bank: {
    bankName: string;
    branchName: string | null;
    ifsc: string;
    accountNumber: string;
    updatedAt: Date;
  } | null,
) {
  const updated = [ids?.updatedAt, bank?.updatedAt].filter(
    (d): d is Date => d instanceof Date,
  );
  return {
    employeeId,
    panNumber: ids?.panNumber ?? null,
    aadhaarNumber: ids?.aadhaarNumber ?? null,
    esiNumber: ids?.esiNumber ?? null,
    pfNumber: ids?.pfNumber ?? null,
    bankName: bank?.bankName ?? null,
    bankBranch: bank?.branchName ?? null,
    bankAccountNo: bank?.accountNumber ?? null,
    bankIfsc: bank?.ifsc ?? null,
    updatedAt:
      updated.length > 0
        ? new Date(Math.max(...updated.map((d) => d.getTime())))
        : null,
  };
}

/** Personal-detail columns from the patch: the Prisma write payload. */
function personalData(
  patch: ProfilePatch,
): Prisma.EmployeePersonalDetailUncheckedUpdateInput {
  const data: Prisma.EmployeePersonalDetailUncheckedUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.dateOfBirth !== undefined)
    data.dateOfBirth =
      patch.dateOfBirth === null ? null : parseDateOnly(patch.dateOfBirth);
  if (patch.gender !== undefined) data.gender = patch.gender;
  if (patch.maritalStatus !== undefined)
    data.maritalStatus = patch.maritalStatus;
  if (patch.bloodGroup !== undefined) data.bloodGroup = patch.bloodGroup;
  if (patch.languages !== undefined) data.languages = patch.languages;
  if (patch.fatherName !== undefined) data.fatherName = patch.fatherName;
  if (patch.motherName !== undefined) data.motherName = patch.motherName;
  if (patch.spouseName !== undefined) data.spouseName = patch.spouseName;
  if (patch.emergencyContactName !== undefined)
    data.emergencyContactName = patch.emergencyContactName;
  if (patch.emergencyContactPhone !== undefined)
    data.emergencyContactPhone = patch.emergencyContactPhone;
  if (patch.emergencyContactRelation !== undefined)
    data.emergencyContactRelation = patch.emergencyContactRelation;
  if (patch.isFresher !== undefined) data.isFresher = patch.isFresher;
  if (patch.experienceYears !== undefined)
    data.experienceYears = patch.experienceYears;
  if (patch.previousCompany !== undefined)
    data.previousCompany = patch.previousCompany;
  if (patch.previousRole !== undefined) data.previousRole = patch.previousRole;
  return data;
}

function addressData(value: AddressValue) {
  return {
    addressLine: value.address,
    areaLocality: value.area ?? null,
    district: value.district ?? null,
    city: value.city,
    state: value.state,
    pincode: value.pincode,
    country: value.country ?? null,
  };
}

const BANK_KEYS = [
  "bankName",
  "bankBranch",
  "bankIfsc",
  "bankAccount",
] as const;
const ID_KEYS = [
  "panNumber",
  "aadhaarNumber",
  "esiNumber",
  "pfNumber",
] as const;

const bankIncomplete = () =>
  new BusinessRuleViolationException(
    "Bank details need a bank name, IFSC and account number together (clear all bank fields to remove them)",
    "BANK_DETAILS_INCOMPLETE",
  );

/**
 * Employee profile and sensitive data, read and written by HR. The rows are
 * the onboarding tables (Docs/ARCHITECTURE.md §7) — one source of truth for
 * what HR and the employee see. Profile reads and writes are routed THROUGH
 * the employee's team and owning user (team scope); the sensitive record is
 * organization-wide by permission. Each write holds the employee row lock,
 * changes the rows and audits the changed field NAMES, in one transaction.
 */
@Injectable()
export class ProfilesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findOne(scope: TeamScope, employeeId: number) {
    const row = await this.prisma.employee.findFirst({
      where: teamWhere(scope, { id: employeeId, deletedAt: null }, OWN_TEAM),
      select: PROFILE_SELECT,
    });
    return row ? toProfileView(row) : null;
  }

  @TeamScoped()
  async upsertProfile(
    scope: TeamScope,
    employeeId: number,
    patch: ProfilePatch,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM hr.employees
         WHERE id = ${employeeId} AND organization_id = ${scope.organizationId}
         FOR UPDATE`;
      const employee = await tx.employee.findFirst({
        where: teamWhere(scope, { id: employeeId, deletedAt: null }, OWN_TEAM),
        select: {
          id: true,
          teamId: true,
          personalDetail: { select: { id: true } },
        },
      });
      if (!employee) return null;
      const owner = {
        organizationId: scope.organizationId,
        teamId: employee.teamId,
        employeeId,
      };

      const data = personalData(patch);
      const existed = employee.personalDetail !== null;
      let entityId = employee.personalDetail?.id;
      if (Object.keys(data).length > 0 || !existed) {
        const saved = await tx.employeePersonalDetail.upsert({
          where: { employeeId },
          create: {
            ...(data as Prisma.EmployeePersonalDetailUncheckedCreateInput),
            ...owner,
            createdBy: actorId,
            updatedBy: actorId,
          },
          update: { ...data, updatedBy: actorId },
          select: { id: true },
        });
        entityId = saved.id;
      }

      // No PRESENT row means "same as permanent" (the wizard's convention).
      for (const [type, value] of [
        ["PERMANENT", patch.permanentAddress],
        ["PRESENT", patch.presentAddress],
      ] as const) {
        if (value === undefined) continue;
        if (value === null) {
          await tx.employeeAddress.deleteMany({
            where: { employeeId, addressType: type },
          });
          continue;
        }
        await tx.employeeAddress.upsert({
          where: { employeeId_addressType: { employeeId, addressType: type } },
          create: {
            ...owner,
            addressType: type,
            ...addressData(value),
            createdBy: actorId,
            updatedBy: actorId,
          },
          update: {
            ...addressData(value),
            deletedAt: null,
            updatedBy: actorId,
          },
        });
      }

      await this.audit.write(tx, {
        entityType: PROFILE_ENTITY,
        entityId: entityId ?? employeeId,
        action: existed ? "update" : "create",
        after: { employeeId, changedFields: changedFieldNames(patch) },
      });

      const row = await tx.employee.findFirstOrThrow({
        where: { id: employeeId },
        select: PROFILE_SELECT,
      });
      return toProfileView(row);
    });
  }

  /**
   * Reads the sensitive record for an employee in the organization. Permission
   * is `hr.employee_sensitive.read` only, so the boundary is the
   * organization. The READ is audited inside the same transaction, before the
   * values are returned: no audit row, no data (fail-closed). The bank
   * account number is returned still encrypted; the service decrypts it.
   */
  @OrgScoped()
  async readSensitive(scope: OrgScope, employeeId: number) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: employeeId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!employee) return null;
      await this.audit.write(tx, {
        entityType: SENSITIVE_ENTITY,
        entityId: employeeId,
        action: "read_sensitive",
        after: { employeeId },
      });
      const [ids, bank] = await Promise.all([
        tx.employeeGovernmentId.findFirst({
          where: {
            employeeId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
        }),
        tx.employeeBankDetail.findFirst({
          where: {
            employeeId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
        }),
      ]);
      return { ids, bank };
    });
  }

  /**
   * Partial update of identifiers (`employee_government_ids`) and bank
   * details (`employee_bank_details`). A new bank row needs bank name, IFSC
   * and account number together (the columns are NOT NULL); clearing every
   * bank field removes the row. Unique PAN/Aadhaar violations propagate for
   * the service to map to a 409.
   */
  @OrgScoped()
  async upsertSensitive(
    scope: OrgScope,
    employeeId: number,
    patch: SensitivePatch,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM hr.employees
         WHERE id = ${employeeId} AND organization_id = ${scope.organizationId}
         FOR UPDATE`;
      const employee = await tx.employee.findFirst({
        where: {
          id: employeeId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { id: true, teamId: true, fullName: true },
      });
      if (!employee) return null;
      const owner = {
        organizationId: scope.organizationId,
        teamId: employee.teamId,
        employeeId,
      };

      const [existingIds, existingBank] = await Promise.all([
        tx.employeeGovernmentId.findUnique({ where: { employeeId } }),
        tx.employeeBankDetail.findUnique({ where: { employeeId } }),
      ]);

      const idData: Prisma.EmployeeGovernmentIdUncheckedUpdateInput = {};
      for (const key of ID_KEYS) {
        if (patch[key] !== undefined) idData[key] = patch[key];
      }
      if (Object.keys(idData).length > 0) {
        await tx.employeeGovernmentId.upsert({
          where: { employeeId },
          create: {
            ...(idData as Prisma.EmployeeGovernmentIdUncheckedCreateInput),
            ...owner,
            createdBy: actorId,
            updatedBy: actorId,
          },
          update: { ...idData, deletedAt: null, updatedBy: actorId },
        });
      }

      if (BANK_KEYS.some((k) => patch[k] !== undefined)) {
        const current = existingBank?.deletedAt ? null : existingBank;
        const next = {
          bankName:
            patch.bankName !== undefined
              ? patch.bankName
              : (current?.bankName ?? null),
          branchName:
            patch.bankBranch !== undefined
              ? patch.bankBranch
              : (current?.branchName ?? null),
          ifsc:
            patch.bankIfsc !== undefined
              ? patch.bankIfsc
              : (current?.ifsc ?? null),
          account:
            patch.bankAccount !== undefined
              ? patch.bankAccount
              : current
                ? {
                    encrypted: current.accountNumberEncrypted,
                    masked: current.accountNumberMasked,
                  }
                : null,
        };
        const anySet =
          next.bankName !== null ||
          next.branchName !== null ||
          next.ifsc !== null ||
          next.account !== null;
        if (!anySet) {
          await tx.employeeBankDetail.deleteMany({ where: { employeeId } });
        } else if (
          next.bankName === null ||
          next.ifsc === null ||
          next.account === null
        ) {
          throw bankIncomplete();
        } else {
          const data = {
            bankName: next.bankName,
            branchName: next.branchName,
            ifsc: next.ifsc,
            accountNumberEncrypted: next.account.encrypted,
            accountNumberMasked: next.account.masked,
          };
          await tx.employeeBankDetail.upsert({
            where: { employeeId },
            create: {
              ...owner,
              ...data,
              accountHolderName: employee.fullName,
              createdBy: actorId,
              updatedBy: actorId,
            },
            update: { ...data, deletedAt: null, updatedBy: actorId },
          });
        }
      }

      const changed = Object.keys(patch).map((k) =>
        k === "bankAccount" ? "bankAccountNo" : k,
      );
      await this.audit.write(tx, {
        entityType: SENSITIVE_ENTITY,
        entityId: employeeId,
        action: existingIds || existingBank ? "update" : "create",
        after: {
          employeeId,
          changedFields: changedFieldNames(
            Object.fromEntries(changed.map((k) => [k, true])),
          ),
        },
      });

      const [ids, bank] = await Promise.all([
        tx.employeeGovernmentId.findFirst({
          where: { employeeId, deletedAt: null },
        }),
        tx.employeeBankDetail.findFirst({
          where: { employeeId, deletedAt: null },
        }),
      ]);
      return { ids, bank };
    });
  }
}
