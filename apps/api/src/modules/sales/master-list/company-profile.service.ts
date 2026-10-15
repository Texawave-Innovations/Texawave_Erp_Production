import { Injectable, Logger } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  gstStateName,
  isGstStateCode,
  stateCodeFromGstin,
} from "../shared/gst.js";
import { FileStorageService } from "../../../shared/file-storage/file-storage.service.js";
import { CompanyProfileRepository } from "./company-profile.repository.js";
import type { UpsertCompanyProfileDto } from "./dto/company-profile.dto.js";
import { acceptImage, dataUri, type UploadedImage } from "./image-upload.js";

export interface CompanyProfile {
  legalName: string;
  tagline: string | null;
  address: string;
  gstin: string | null;
  stateCode: string;
  stateName: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  /** A logo is uploaded (GET /sales/master/company-profile/logo). */
  hasLogo: boolean;
}

type ProfileRow = Omit<CompanyProfile, "stateName" | "hasLogo"> & {
  logoStorageKey: string | null;
  logoMimeType: string | null;
};

/** Sales master list — the seller's details printed on every document. */
@Injectable()
export class CompanyProfileService {
  private readonly logger = new Logger(CompanyProfileService.name);

  constructor(
    private readonly repository: CompanyProfileRepository,
    private readonly tenantContext: TenantContextService,
    private readonly files: FileStorageService,
  ) {}

  /** The profile, or null when it has not been set up yet. */
  async find(): Promise<CompanyProfile | null> {
    const row = await this.repository.find(this.tenantContext.getOrgScope());
    return row ? this.view(row) : null;
  }

  async upsert(dto: UpsertCompanyProfileDto): Promise<CompanyProfile> {
    const gstin = dto.gstin ?? null;
    const gstinState = gstin ? stateCodeFromGstin(gstin) : null;
    const stateCode = dto.stateCode ?? gstinState;
    if (stateCode === null || !isGstStateCode(stateCode)) {
      throw new BusinessRuleViolationException(
        "The company needs a valid GST state (from its GSTIN or entered)",
        "INVALID_STATE_CODE",
      );
    }
    if (gstinState !== null && gstinState !== stateCode) {
      throw new BusinessRuleViolationException(
        `GSTIN ${gstin} belongs to state ${gstinState}, not ${stateCode}`,
        "STATE_GSTIN_MISMATCH",
      );
    }
    const pan = dto.pan ?? (gstin ? gstin.slice(2, 12) : null);
    if (gstin && pan !== gstin.slice(2, 12)) {
      throw new BusinessRuleViolationException(
        `PAN ${pan} does not match the PAN inside GSTIN ${gstin}`,
        "PAN_GSTIN_MISMATCH",
      );
    }
    const row = await this.repository.upsert(
      this.tenantContext.getOrgScope(),
      {
        legalName: dto.legalName,
        tagline: dto.tagline ?? null,
        address: dto.address,
        gstin,
        stateCode,
        pan,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
      },
      this.tenantContext.getUserId(),
    );
    return this.view(row);
  }

  /** Public, read-only: the profile every Sales document needs (its state
   * decides CGST+SGST vs IGST). 422 until it is set up. */
  async require(): Promise<CompanyProfile> {
    const profile = await this.find();
    if (!profile) {
      throw new BusinessRuleViolationException(
        "Set up the company profile in the Sales master list first",
        "COMPANY_PROFILE_REQUIRED",
      );
    }
    return profile;
  }

  /** Uploads or replaces the logo (PNG/JPG, ≤ 2 MB). The profile must
   * exist first. */
  async uploadLogo(file: UploadedImage | undefined): Promise<CompanyProfile> {
    const scope = this.tenantContext.getOrgScope();
    await this.require();
    const image = acceptImage(file, scope.organizationId, "logo");
    await this.files.save(image.storageKey, (file as UploadedImage).buffer);
    let previous: string | null | undefined;
    try {
      previous = await this.repository.setLogo(
        scope,
        image,
        this.tenantContext.getUserId(),
      );
    } catch (error) {
      await this.files.remove(image.storageKey);
      throw error;
    }
    if (previous === undefined) {
      await this.files.remove(image.storageKey);
      return this.require();
    }
    if (previous) await this.removeQuietly(previous);
    return this.require();
  }

  async removeLogo(): Promise<CompanyProfile> {
    await this.require();
    const previous = await this.repository.setLogo(
      this.tenantContext.getOrgScope(),
      null,
      this.tenantContext.getUserId(),
    );
    if (previous) await this.removeQuietly(previous);
    return this.require();
  }

  async readLogo(): Promise<{ buffer: Buffer; mimeType: string }> {
    const row = await this.repository.find(this.tenantContext.getOrgScope());
    if (!row?.logoStorageKey || !row.logoMimeType) {
      throw new ResourceNotFoundException("Company logo", "current");
    }
    return {
      buffer: await this.files.read(row.logoStorageKey),
      mimeType: row.logoMimeType,
    };
  }

  /** Public, read-only: the logo as a data URI for PDFs (null = none). */
  async logoDataUri(): Promise<string | null> {
    try {
      const logo = await this.readLogo();
      return dataUri(logo.mimeType, logo.buffer);
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) {
        this.logger.warn(`Company logo unreadable: ${String(error)}`);
      }
      return null;
    }
  }

  private async removeQuietly(key: string): Promise<void> {
    try {
      await this.files.remove(key);
    } catch (error) {
      this.logger.warn(
        `Could not remove replaced logo ${key}: ${String(error)}`,
      );
    }
  }

  private view(row: ProfileRow): CompanyProfile {
    return {
      legalName: row.legalName,
      tagline: row.tagline,
      address: row.address,
      gstin: row.gstin,
      stateCode: row.stateCode,
      stateName: gstStateName(row.stateCode),
      pan: row.pan,
      email: row.email,
      phone: row.phone,
      hasLogo: row.logoStorageKey !== null,
    };
  }
}
