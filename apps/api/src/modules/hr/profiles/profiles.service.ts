import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { FieldEncryptionService } from "../../../shared/crypto/field-encryption.service.js";
import { HtmlPdfRenderer } from "../../../shared/pdf/html-pdf-renderer.js";
import { asGovernmentIdConflict } from "../../employee-self-service/profile/government-id-conflict.js";
import { BLOOD_GROUPS } from "../../employee-self-service/profile/dto/onboarding-rules.js";
import type {
  AddressDto,
  UpdateEmployeeProfileDto,
  UpdateEmployeeSensitiveDto,
} from "./dto/profile.dto.js";
import { renderProfileHtml } from "./profile-pdf.template.js";
import {
  type AddressValue,
  type ProfilePatch,
  type SensitivePatch,
  ProfilesRepository,
  toSensitiveView,
} from "./profiles.repository.js";
import {
  normalizeLanguages,
  toBloodGroupCode,
  toGenderCode,
  toMaritalCode,
} from "./profiles.rules.js";

const READ = "hr.employee_profile.read";
const WRITE = "hr.employee_profile.write";

@Injectable()
export class ProfilesService {
  constructor(
    private readonly repository: ProfilesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly encryption: FieldEncryptionService,
    private readonly pdf: HtmlPdfRenderer,
  ) {}

  /** 404 — not 403 — for an employee outside the caller's scope. */
  async getProfile(employeeId: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const view = await this.repository.findOne(scope, employeeId);
    if (!view) throw new ResourceNotFoundException("Employee", employeeId);
    return view;
  }

  /** The profile as a PDF — same scope as reading it, no sensitive fields. */
  async getProfilePdf(employeeId: number) {
    const view = await this.getProfile(employeeId);
    const buffer = await this.pdf.render(renderProfileHtml(view, new Date()));
    return { buffer, fileName: `${view.employee.employeeCode}-profile.pdf` };
  }

  async updateProfile(employeeId: number, dto: UpdateEmployeeProfileDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    if (scope.level === "own") {
      // Nobody edits their own profile through HR routes; employees use the
      // self-service onboarding routes (employee/profile/*).
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

  /** Organization-wide by permission (`hr.employee_sensitive.read` only).
   * Audited before anything is returned; the account number is decrypted
   * only here, for this permission. */
  async getSensitive(employeeId: number) {
    const found = await this.repository.readSensitive(
      this.tenantContext.getOrgScope(),
      employeeId,
    );
    if (!found) throw new ResourceNotFoundException("Employee", employeeId);
    return this.toView(employeeId, found);
  }

  async updateSensitive(employeeId: number, dto: UpdateEmployeeSensitiveDto) {
    let saved;
    try {
      saved = await this.repository.upsertSensitive(
        this.tenantContext.getOrgScope(),
        employeeId,
        this.toSensitivePatch(dto),
        this.tenantContext.getUserId(),
      );
    } catch (error) {
      throw asGovernmentIdConflict(error);
    }
    if (!saved) throw new ResourceNotFoundException("Employee", employeeId);
    return this.toView(employeeId, saved);
  }

  private toView(
    employeeId: number,
    found: NonNullable<
      Awaited<ReturnType<ProfilesRepository["readSensitive"]>>
    >,
  ) {
    const bank = found.bank
      ? {
          bankName: found.bank.bankName,
          branchName: found.bank.branchName,
          ifsc: found.bank.ifsc,
          accountNumber: this.encryption.decrypt(
            found.bank.accountNumberEncrypted,
          ),
          updatedAt: found.bank.updatedAt,
        }
      : null;
    return toSensitiveView(employeeId, found.ids, bank);
  }

  private toSensitivePatch(dto: UpdateEmployeeSensitiveDto): SensitivePatch {
    const patch: SensitivePatch = {};
    if (dto.panNumber !== undefined) patch.panNumber = dto.panNumber;
    if (dto.aadhaarNumber !== undefined)
      patch.aadhaarNumber = dto.aadhaarNumber;
    if (dto.esiNumber !== undefined) patch.esiNumber = dto.esiNumber;
    if (dto.pfNumber !== undefined) patch.pfNumber = dto.pfNumber;
    if (dto.bankName !== undefined) patch.bankName = dto.bankName;
    if (dto.bankBranch !== undefined) patch.bankBranch = dto.bankBranch;
    if (dto.bankIfsc !== undefined) patch.bankIfsc = dto.bankIfsc;
    if (dto.bankAccountNo !== undefined) {
      patch.bankAccount =
        dto.bankAccountNo === null
          ? null
          : {
              encrypted: this.encryption.encrypt(dto.bankAccountNo),
              masked: this.encryption.mask(dto.bankAccountNo),
            };
    }
    return patch;
  }
}

/** Accepts common spellings, stores the onboarding wizard's code; anything
 * else is a 400 naming the accepted values. */
function code(
  field: string,
  value: string,
  toCode: (v: string) => string | undefined,
  accepted: string,
): string {
  const result = toCode(value);
  if (result === undefined) {
    throw new BadRequestException([`${field} must be one of: ${accepted}`]);
  }
  return result;
}

/** Only the keys the request named. `null` clears a nullable field; a
 * non-nullable flag sent as `null` is stored as false; languages as []. */
function toProfilePatch(dto: UpdateEmployeeProfileDto): ProfilePatch {
  const patch: ProfilePatch = {};
  if (dto.title !== undefined) patch.title = dto.title;
  if (dto.dateOfBirth !== undefined) patch.dateOfBirth = dto.dateOfBirth;
  if (dto.gender !== undefined)
    patch.gender =
      dto.gender === null
        ? null
        : code("gender", dto.gender, toGenderCode, "MALE, FEMALE, OTHER");
  if (dto.maritalStatus !== undefined)
    patch.maritalStatus =
      dto.maritalStatus === null
        ? null
        : code(
            "maritalStatus",
            dto.maritalStatus,
            toMaritalCode,
            "SINGLE, MARRIED, OTHER",
          );
  if (dto.bloodGroup !== undefined)
    patch.bloodGroup =
      dto.bloodGroup === null
        ? null
        : code(
            "bloodGroup",
            dto.bloodGroup,
            (v) => toBloodGroupCode(v, BLOOD_GROUPS),
            BLOOD_GROUPS.join(", "),
          );
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
  if (value === undefined || value === null) return null;
  return {
    address: value.address,
    area: value.area || undefined,
    district: value.district || undefined,
    city: value.city,
    state: value.state,
    pincode: value.pincode,
    country: value.country || undefined,
  };
}
