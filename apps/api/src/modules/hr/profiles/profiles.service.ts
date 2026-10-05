import { ForbiddenException, Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  AddressDto,
  UpdateEmployeeProfileDto,
  UpdateEmployeeSensitiveDto,
} from "./dto/profile.dto.js";
import {
  type AddressValue,
  type ProfilePatch,
  type SensitivePatch,
  ProfilesRepository,
} from "./profiles.repository.js";
import { normalizeLanguages } from "./profiles.rules.js";

const READ = "hr.employee_profile.read";
const WRITE = "hr.employee_profile.write";

@Injectable()
export class ProfilesService {
  constructor(
    private readonly repository: ProfilesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  /** 404 — not 403 — for an employee outside the caller's scope. */
  async getProfile(employeeId: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const view = await this.repository.findOne(scope, employeeId);
    if (!view) throw new ResourceNotFoundException("Employee", employeeId);
    return view;
  }

  async updateProfile(employeeId: number, dto: UpdateEmployeeProfileDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      // Nobody edits their own profile through HR routes. Self-submission is a
      // reported conflict, not a built feature (HR_LEGACY_PARITY.md §11.5).
      throw new ForbiddenException("You may not edit your own profile here");
    }
    const view = await this.repository.upsertProfile(
      scope,
      employeeId,
      toProfilePatch(dto),
      this.tenantContext.getUserId(),
    );
    if (!view) throw new ResourceNotFoundException("Employee", employeeId);
    return view;
  }

  /** Organization-wide by permission (`hr.employee_sensitive.read` only). */
  async getSensitive(employeeId: number) {
    const view = await this.repository.readSensitive(
      this.tenantContext.getOrgScope(),
      employeeId,
    );
    if (!view) throw new ResourceNotFoundException("Employee", employeeId);
    return view;
  }

  async updateSensitive(employeeId: number, dto: UpdateEmployeeSensitiveDto) {
    const view = await this.repository.upsertSensitive(
      this.tenantContext.getOrgScope(),
      employeeId,
      toSensitivePatch(dto),
      this.tenantContext.getUserId(),
    );
    if (!view) throw new ResourceNotFoundException("Employee", employeeId);
    return view;
  }
}

/** Only the keys the request named. `null` clears a nullable field; a
 * non-nullable flag sent as `null` is stored as false; languages as []. */
function toProfilePatch(dto: UpdateEmployeeProfileDto): ProfilePatch {
  const patch: ProfilePatch = {};
  if (dto.title !== undefined) patch.title = dto.title;
  if (dto.dateOfBirth !== undefined) patch.dateOfBirth = dto.dateOfBirth;
  if (dto.gender !== undefined) patch.gender = dto.gender;
  if (dto.maritalStatus !== undefined) patch.maritalStatus = dto.maritalStatus;
  if (dto.bloodGroup !== undefined) patch.bloodGroup = dto.bloodGroup;
  if (dto.languages !== undefined)
    patch.languages = normalizeLanguages(dto.languages);
  if (dto.fatherName !== undefined) patch.fatherName = dto.fatherName;
  if (dto.motherName !== undefined) patch.motherName = dto.motherName;
  if (dto.spouseName !== undefined) patch.spouseName = dto.spouseName;
  if (dto.emergencyContactName !== undefined)
    patch.emergencyContactName = dto.emergencyContactName;
  if (dto.emergencyContactPhone !== undefined)
    patch.emergencyContactPhone = dto.emergencyContactPhone;
  if (dto.emergencyContactRelation !== undefined)
    patch.emergencyContactRelation = dto.emergencyContactRelation;
  if (dto.presentAddress !== undefined)
    patch.presentAddress = toAddress(dto.presentAddress);
  if (dto.permanentAddress !== undefined)
    patch.permanentAddress = toAddress(dto.permanentAddress);
  if (dto.isFresher !== undefined) patch.isFresher = dto.isFresher ?? false;
  if (dto.experienceYears !== undefined)
    patch.experienceYears =
      dto.experienceYears === null ? null : dto.experienceYears.toFixed(1);
  if (dto.previousCompany !== undefined)
    patch.previousCompany = dto.previousCompany;
  if (dto.previousRole !== undefined) patch.previousRole = dto.previousRole;
  return patch;
}

function toAddress(value: AddressDto | null | undefined): AddressValue | null {
  if (value === undefined) return null;
  if (value === null) return null;
  return {
    address: value.address,
    area: value.area,
    district: value.district,
    city: value.city,
    state: value.state,
    pincode: value.pincode,
    country: value.country,
  };
}

function toSensitivePatch(dto: UpdateEmployeeSensitiveDto): SensitivePatch {
  const patch: SensitivePatch = {};
  if (dto.panNumber !== undefined) patch.panNumber = dto.panNumber;
  if (dto.aadhaarNumber !== undefined) patch.aadhaarNumber = dto.aadhaarNumber;
  if (dto.esiNumber !== undefined) patch.esiNumber = dto.esiNumber;
  if (dto.pfNumber !== undefined) patch.pfNumber = dto.pfNumber;
  if (dto.bankName !== undefined) patch.bankName = dto.bankName;
  if (dto.bankBranch !== undefined) patch.bankBranch = dto.bankBranch;
  if (dto.bankAccountNo !== undefined) patch.bankAccountNo = dto.bankAccountNo;
  if (dto.bankIfsc !== undefined) patch.bankIfsc = dto.bankIfsc;
  return patch;
}
