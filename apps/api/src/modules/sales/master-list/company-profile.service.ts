import { Injectable } from "@nestjs/common";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  gstStateName,
  isGstStateCode,
  stateCodeFromGstin,
} from "../shared/gst.js";
import { CompanyProfileRepository } from "./company-profile.repository.js";
import type { UpsertCompanyProfileDto } from "./dto/company-profile.dto.js";

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
}

/** Sales master list — the seller's details printed on every document. */
@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly repository: CompanyProfileRepository,
    private readonly tenantContext: TenantContextService,
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

  private view(row: Omit<CompanyProfile, "stateName">): CompanyProfile {
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
    };
  }
}
