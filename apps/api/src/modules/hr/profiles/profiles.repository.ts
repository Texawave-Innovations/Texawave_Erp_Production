import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../common/decorators/team-scoped.decorator.js";
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

export type SensitivePatch = Partial<{
  panNumber: string | null;
  aadhaarNumber: string | null;
  esiNumber: string | null;
  pfNumber: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
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

/** Team/owner routing for an employee row (the row IS the employee). */
const OWN_TEAM = { teamField: "teamId", ownerField: "userId" };

function jsonOrNull(
  value: AddressValue | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null) return Prisma.DbNull;
  return { ...value } as Prisma.InputJsonValue;
}

export function toProfileView(
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    workEmail: string | null;
    phone: string | null;
    dateOfJoining: Date;
    status: string;
  },
  profile: {
    title: string | null;
    dateOfBirth: Date | null;
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
    presentAddress: unknown;
    permanentAddress: unknown;
    isFresher: boolean;
    experienceYears: Prisma.Decimal | null;
    previousCompany: string | null;
    previousRole: string | null;
    updatedAt: Date;
  } | null,
) {
  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      workEmail: employee.workEmail,
      phone: employee.phone,
      dateOfJoining: formatDateOnly(employee.dateOfJoining),
      status: employee.status,
    },
    profile: {
      title: profile?.title ?? null,
      dateOfBirth: profile?.dateOfBirth
        ? formatDateOnly(profile.dateOfBirth)
        : null,
      gender: profile?.gender ?? null,
      maritalStatus: profile?.maritalStatus ?? null,
      bloodGroup: profile?.bloodGroup ?? null,
      languages: profile?.languages ?? [],
      fatherName: profile?.fatherName ?? null,
      motherName: profile?.motherName ?? null,
      spouseName: profile?.spouseName ?? null,
      emergencyContact: {
        name: profile?.emergencyContactName ?? null,
        phone: profile?.emergencyContactPhone ?? null,
        relation: profile?.emergencyContactRelation ?? null,
      },
      presentAddress:
        (profile?.presentAddress as AddressValue | null | undefined) ?? null,
      permanentAddress:
        (profile?.permanentAddress as AddressValue | null | undefined) ?? null,
      isFresher: profile?.isFresher ?? false,
      experienceYears: profile?.experienceYears
        ? Number(profile.experienceYears.toFixed(1))
        : null,
      previousCompany: profile?.previousCompany ?? null,
      previousRole: profile?.previousRole ?? null,
      updatedAt: profile?.updatedAt ?? null,
    },
  };
}

export function toSensitiveView(
  employeeId: number,
  row: {
    panNumber: string | null;
    aadhaarNumber: string | null;
    esiNumber: string | null;
    pfNumber: string | null;
    bankName: string | null;
    bankBranch: string | null;
    bankAccountNo: string | null;
    bankIfsc: string | null;
    updatedAt: Date;
  } | null,
) {
  return {
    employeeId,
    panNumber: row?.panNumber ?? null,
    aadhaarNumber: row?.aadhaarNumber ?? null,
    esiNumber: row?.esiNumber ?? null,
    pfNumber: row?.pfNumber ?? null,
    bankName: row?.bankName ?? null,
    bankBranch: row?.bankBranch ?? null,
    bankAccountNo: row?.bankAccountNo ?? null,
    bankIfsc: row?.bankIfsc ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

/** Profile fields the database stores as columns: the Prisma write payload. */
function profileData(
  patch: ProfilePatch,
): Prisma.EmployeeProfileUncheckedUpdateInput {
  const data: Prisma.EmployeeProfileUncheckedUpdateInput = {};
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
  if (patch.presentAddress !== undefined)
    data.presentAddress = jsonOrNull(patch.presentAddress);
  if (patch.permanentAddress !== undefined)
    data.permanentAddress = jsonOrNull(patch.permanentAddress);
  if (patch.isFresher !== undefined) data.isFresher = patch.isFresher;
  if (patch.experienceYears !== undefined)
    data.experienceYears = patch.experienceYears;
  if (patch.previousCompany !== undefined)
    data.previousCompany = patch.previousCompany;
  if (patch.previousRole !== undefined) data.previousRole = patch.previousRole;
  return data;
}

/**
 * Employee profile data. Reads and writes are routed THROUGH the employee's team
 * and owning user (team scope). Each write holds a row lock, changes the row,
 * and audits the changed field NAMES, in one transaction.
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
      select: { ...EMPLOYEE_SELECT, profile: true },
    });
    if (!row) return null;
    const { profile, ...employee } = row;
    return toProfileView(employee, profile);
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
        select: { ...EMPLOYEE_SELECT, profile: true },
      });
      if (!employee) return null;

      const data = profileData(patch);
      const existed = employee.profile !== null;
      const saved = await tx.employeeProfile.upsert({
        where: { employeeId },
        create: {
          ...(data as Prisma.EmployeeProfileUncheckedCreateInput),
          organizationId: scope.organizationId,
          employeeId,
          createdBy: actorId,
          updatedBy: actorId,
        },
        update: { ...data, updatedBy: actorId },
      });

      await this.audit.write(tx, {
        entityType: PROFILE_ENTITY,
        entityId: saved.id,
        action: existed ? "update" : "create",
        after: { employeeId, changedFields: changedFieldNames(patch) },
      });

      const { profile: _previous, ...row } = employee;
      return toProfileView(row, saved);
    });
  }

  /**
   * Reads the sensitive record for an employee in the organization. Permission
   * is `hr.employee_sensitive.read` only, so the boundary is the
   * organization. The READ is audited inside the same transaction, before the
   * values are returned: no audit row, no data (fail-closed).
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
      const row = await tx.employeeSensitiveInfo.findFirst({
        where: { employeeId, organizationId: scope.organizationId },
      });
      return toSensitiveView(employeeId, row);
    });
  }

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
        select: { id: true },
      });
      if (!employee) return null;

      const existing = await tx.employeeSensitiveInfo.findFirst({
        where: { employeeId, organizationId: scope.organizationId },
        select: { id: true },
      });
      const saved = await tx.employeeSensitiveInfo.upsert({
        where: { employeeId },
        create: {
          organizationId: scope.organizationId,
          employeeId,
          ...patch,
          createdBy: actorId,
          updatedBy: actorId,
        },
        update: { ...patch, updatedBy: actorId },
      });

      await this.audit.write(tx, {
        entityType: SENSITIVE_ENTITY,
        entityId: saved.id,
        action: existing ? "update" : "create",
        after: { employeeId, changedFields: changedFieldNames(patch) },
      });
      return toSensitiveView(employeeId, saved);
    });
  }
}
