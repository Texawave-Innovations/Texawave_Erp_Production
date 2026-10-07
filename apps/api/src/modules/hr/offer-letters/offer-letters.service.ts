import { Injectable } from "@nestjs/common";
import { formatDateOnly } from "../../../common/dates/date-only.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateOfferLetterDto,
  QueryOfferLetterDto,
  UpdateOfferLetterDto,
} from "./dto/offer-letter.dto.js";
import {
  OFFER_LETTER_DEFAULTS,
  defaultValidityDate,
} from "./offer-letters.rules.js";
import {
  type NewOfferLetter,
  type OfferLetterPatch,
  OfferLettersRepository,
} from "./offer-letters.repository.js";

@Injectable()
export class OfferLettersService {
  constructor(
    private readonly repository: OfferLettersRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryOfferLetterDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      { search: query.search },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Offer letter", id);
    return row;
  }

  /** Applies the legacy prefills for anything the request omits. */
  create(dto: CreateOfferLetterDto) {
    const today = new Date();
    const input: NewOfferLetter = {
      candidateName: dto.candidateName,
      role: dto.role,
      location: dto.location ?? OFFER_LETTER_DEFAULTS.location,
      reportingManager:
        dto.reportingManager ?? OFFER_LETTER_DEFAULTS.reportingManager,
      offerDate: dto.offerDate ?? formatDateOnly(today),
      joiningDate: dto.joiningDate,
      offerValidityDate: dto.offerValidityDate ?? defaultValidityDate(today),
      basic: money(dto.basic),
      da: money(dto.da),
      hra: money(dto.hra),
      ca: money(dto.ca),
      workScheduleMonFri:
        dto.workScheduleMonFri ?? OFFER_LETTER_DEFAULTS.workScheduleMonFri,
      workScheduleSat:
        dto.workScheduleSat ?? OFFER_LETTER_DEFAULTS.workScheduleSat,
      workScheduleSun:
        dto.workScheduleSun ?? OFFER_LETTER_DEFAULTS.workScheduleSun,
      signatoryName: dto.signatoryName ?? OFFER_LETTER_DEFAULTS.signatoryName,
      signatoryDesignation:
        dto.signatoryDesignation ?? OFFER_LETTER_DEFAULTS.signatoryDesignation,
      companyEmail: dto.companyEmail ?? OFFER_LETTER_DEFAULTS.companyEmail,
      companyPhone: dto.companyPhone ?? OFFER_LETTER_DEFAULTS.companyPhone,
      companyWebsite:
        dto.companyWebsite ?? OFFER_LETTER_DEFAULTS.companyWebsite,
      companyAddress:
        dto.companyAddress ?? OFFER_LETTER_DEFAULTS.companyAddress,
    };
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      input,
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateOfferLetterDto) {
    const row = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      toPatch(dto),
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("Offer letter", id);
    return row;
  }
}

/** Money as the 2-dp string the DECIMAL(12,2) column takes; undefined → 0. */
function money(value: number | undefined): string {
  return (value ?? 0).toFixed(2);
}

/** Only the fields the request names are written. */
function toPatch(dto: UpdateOfferLetterDto): OfferLetterPatch {
  const patch: OfferLetterPatch = {};
  const money2 = (v: number | undefined) =>
    v === undefined ? undefined : money(v);
  const set = <K extends keyof OfferLetterPatch>(
    key: K,
    value: OfferLetterPatch[K] | undefined,
  ) => {
    if (value !== undefined) patch[key] = value;
  };
  set("candidateName", dto.candidateName);
  set("role", dto.role);
  set("location", dto.location);
  set("reportingManager", dto.reportingManager);
  set("offerDate", dto.offerDate);
  set("joiningDate", dto.joiningDate);
  set("offerValidityDate", dto.offerValidityDate);
  set("basic", money2(dto.basic));
  set("da", money2(dto.da));
  set("hra", money2(dto.hra));
  set("ca", money2(dto.ca));
  set("workScheduleMonFri", dto.workScheduleMonFri);
  set("workScheduleSat", dto.workScheduleSat);
  set("workScheduleSun", dto.workScheduleSun);
  set("signatoryName", dto.signatoryName);
  set("signatoryDesignation", dto.signatoryDesignation);
  set("companyEmail", dto.companyEmail);
  set("companyPhone", dto.companyPhone);
  set("companyWebsite", dto.companyWebsite);
  set("companyAddress", dto.companyAddress);
  return patch;
}
