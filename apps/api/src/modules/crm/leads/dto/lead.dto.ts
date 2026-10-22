import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

/** Mirrors `LEAD_STATUSES` in the legacy TexaWave_ERP/src/modules/crm/
 * Leads.tsx exactly. Kept as a DTO-level vocabulary (not a Postgres enum —
 * no enum type exists anywhere in this schema) so a new status can be
 * added without a migration, same convention as every other status field
 * in this codebase. */
export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "NOT_INTERESTED",
  "FOLLOW_UP",
  "MEETING_PENDING",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_PRIORITIES = ["High", "Medium", "Low"] as const;
export const LEAD_RATINGS = ["Hot", "Warm", "Cold"] as const;

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/Leads.tsx.
 * `companyName` and `prospectName` are hard-required, mirroring the legacy
 * client-side save guard. `leadStatus` defaults to `NEW`, matching a
 * freshly added legacy row (`emptyLeadRow()`). `linkedAccountId`/
 * `linkedContactId`/`leadStatus: CONVERTED` are never set through this DTO
 * — only through `POST /crm/leads/:id/convert` (see leads.service.ts). */
export class CreateLeadDto {
  @ApiProperty({ example: "Acme Corp" })
  @Trim()
  @IsString()
  @Length(1, 200)
  companyName!: string;

  @ApiProperty({ example: "Jane Doe" })
  @Trim()
  @IsString()
  @Length(1, 150)
  prospectName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  hq?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 50)
  annualRevenue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 50)
  numberOfEmployees?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  contactNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  fax?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  skypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  meetingStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  meetingScheduled?: string;

  @ApiPropertyOptional({ description: "ISO date-time" })
  @IsOptional()
  @IsDateString()
  meetingDate?: string;

  @ApiPropertyOptional({ enum: LEAD_STATUSES, default: "NEW" })
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  leadStatus?: LeadStatus;

  @ApiPropertyOptional({ enum: LEAD_PRIORITIES })
  @IsOptional()
  @IsIn(LEAD_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({ enum: LEAD_RATINGS })
  @IsOptional()
  @IsIn(LEAD_RATINGS)
  rating?: string;

  @ApiPropertyOptional({ description: "Free-text month (legacy lead field)" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 50)
  month?: string;

  @ApiPropertyOptional({
    description: "CrmCustomFieldDef key -> value (module 'leads')",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, string>;

  @ApiPropertyOptional({
    description: "Free-text owner name, as legacy stores it",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  leadSource?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  emailOptOut?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  dataProcessingBasis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 250)
  addressStreet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  country?: string;

  @ApiPropertyOptional({ description: "Comma-separated tags" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  tags?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  areaOfInterest?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  comments?: string;
}

/** `linkedAccountId`/`linkedContactId` are intentionally omitted — never
 * settable through a general PATCH. Only `POST /crm/leads/:id/convert`
 * sets them, same "no silent side effect" rule as Contact's accountId. */
export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class QueryLeadDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      "Matches companyName/prospectName/email/contactNumber (case-insensitive)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: LEAD_STATUSES })
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  leadStatus?: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  leadSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  country?: string;

  @ApiPropertyOptional({ enum: ["CONVERTED", "NOT_CONVERTED"] })
  @IsOptional()
  @IsIn(["CONVERTED", "NOT_CONVERTED"])
  converted?: "CONVERTED" | "NOT_CONVERTED";

  @ApiPropertyOptional({ enum: LEAD_RATINGS })
  @IsOptional()
  @IsIn(LEAD_RATINGS)
  rating?: string;

  @ApiPropertyOptional({ enum: ["TOUCHED", "UNTOUCHED"] })
  @IsOptional()
  @IsIn(["TOUCHED", "UNTOUCHED"])
  touched?: "TOUCHED" | "UNTOUCHED";

  @ApiPropertyOptional({ description: "User id of the creator" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  createdBy?: number;

  @ApiPropertyOptional({ description: "ISO date (inclusive)" })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: "ISO date (inclusive)" })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ description: "Minimum annual revenue (numeric part)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAnnualRevenue?: number;

  @ApiPropertyOptional({ enum: ["createdAt", "companyName"] })
  @IsOptional()
  @IsIn(["createdAt", "companyName"])
  sortBy?: "createdAt" | "companyName";
}

/** `POST /crm/leads/:id/convert` — reproduces legacy
 * `domain/LeadConvertDialog.tsx` in full, including the "Create a Deal"
 * step (`createDeal`, default-on in legacy; mirrored here as opt-in via
 * presence, see leads.repository.ts `convert()`). `dealStageId` mirrors
 * legacy's `boardStages[0]?.id || 'new_lead'` fallback when omitted. */
export class ConvertLeadDto {
  @ApiProperty({ enum: ["new", "existing"] })
  @IsIn(["new", "existing"])
  accountMode!: "new" | "existing";

  @ApiPropertyOptional({
    description: "Required when accountMode is 'existing'",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  existingAccountId?: number;

  @ApiPropertyOptional({ description: "Omit to skip creating a Contact" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  contactTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  contactPhone?: string;

  @ApiPropertyOptional({
    description:
      "Set true to proceed after a DUPLICATE_ACCOUNT warning (matches legacy's 'Create anyway' button)",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  createDeal?: boolean;

  @ApiPropertyOptional({
    description: "Defaults to '<companyName> — Opportunity'",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  dealTitle?: string;

  @ApiPropertyOptional({ description: "Defaults to 0" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dealAmount?: number;

  @ApiPropertyOptional({ description: "ISO date" })
  @IsOptional()
  @IsDateString()
  dealCloseDate?: string;

  @ApiPropertyOptional({
    description: "Defaults to the org's first board stage",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dealStageId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  campaignSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  contactRole?: string;
}

export class CreateLeadNoteDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 5000)
  content!: string;
}
