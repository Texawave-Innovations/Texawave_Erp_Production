import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const OPPORTUNITY_STATUSES = ["OPEN", "WON", "LOST", "ON_HOLD"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const OPPORTUNITY_PRIORITIES = ["High", "Medium", "Low"] as const;

export const LOST_REASONS = [
  "Pricing",
  "Competitor Selected",
  "No Budget",
  "Requirement Not Supported",
  "Decision Delayed",
  "No Response",
  "Project Cancelled",
  "Internal Approval Failed",
  "Timeline Issue",
  "Product Gap",
  "Relationship Issue",
  "Other",
] as const;

export const HOLD_REASONS = [
  "Budget Freeze",
  "Client Requested Pause",
  "Internal Priority Change",
  "Awaiting Approval",
  "Awaiting Documentation",
  "Resourcing Constraint",
  "Other",
] as const;

export const STUCK_REASONS = [
  "Waiting for Client",
  "Client Unavailable",
  "Internal Approval Pending",
  "Pricing Discussion",
  "Technical Clarification",
  "No Response",
  "Competitor Evaluation",
  "Budget Issue",
  "Management Discussion",
  "Other",
] as const;

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/Pipeline.tsx
 * "+New Deal" dialog, which requires exactly these four fields
 * (`title`/`accountId`/`ownerName`/`estimatedValue` — see the
 * `FieldSchema` import-export definitions in Pipeline.tsx). `stageId` is
 * additionally required here since production has no implicit "first
 * board stage" global default the way legacy's static seed order did —
 * the caller must pick one explicitly (the UI defaults it to the board's
 * first stage, same visual result). `leadId` is deliberately not
 * settable through this DTO — it is only ever set by
 * `LeadsRepository.convert()`, inline, in the same transaction as the
 * Lead update (see leads.repository.ts). */
export class CreateOpportunityDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contactId?: number;

  @ApiProperty({ example: "Acme Corp — Website Revamp" })
  @Trim()
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ description: "Free-text deal owner name" })
  @Trim()
  @IsString()
  @Length(1, 150)
  ownerName!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageId!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedValue!: number;

  @ApiPropertyOptional({ default: "INR" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 10)
  currency?: string;

  @ApiPropertyOptional({ description: "ISO date" })
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional({ enum: OPPORTUNITY_PRIORITIES })
  @IsOptional()
  @IsIn(OPPORTUNITY_PRIORITIES)
  priority?: string;

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

/** `stageId` is excluded — a stage move always goes through
 * `POST /:id/stage` (and the dedicated won/lost/on-hold/reopen actions),
 * never a silent side effect of a general PATCH, same "no implicit
 * side effect" rule as Contact's accountId. */
export class UpdateOpportunityDto extends PartialType(
  OmitType(CreateOpportunityDto, ["stageId"] as const),
) {}

export class QueryOpportunityDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Matches title/ownerName/account name (case-insensitive)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageId?: number;

  @ApiPropertyOptional({ enum: OPPORTUNITY_STATUSES })
  @IsOptional()
  @IsIn(OPPORTUNITY_STATUSES)
  status?: OpportunityStatus;
}

export class ChangeStageDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  remarks?: string;
}

export class MarkWonDto {
  @ApiPropertyOptional({
    description: "Defaults to estimatedValue when omitted",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingAmount?: number;

  @ApiPropertyOptional({
    description: "ISO date; defaults to expectedCloseDate when omitted",
  })
  @IsOptional()
  @IsDateString()
  closingDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  remarks?: string;
}

export class MarkLostDto {
  @ApiProperty({ enum: LOST_REASONS })
  @IsIn(LOST_REASONS)
  reason!: string;

  @ApiPropertyOptional({
    description: "Required detail when reason is 'Other'",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  reasonOther?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  competitor?: string;
}

export class SetOnHoldDto {
  @ApiProperty({ enum: HOLD_REASONS })
  @IsIn(HOLD_REASONS)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  reasonOther?: string;

  @ApiPropertyOptional({ description: "ISO date" })
  @IsOptional()
  @IsDateString()
  expectedResumeDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class ReopenDto {
  @ApiProperty({ description: "Stage to reopen into" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageId!: number;
}

export class SetStuckReasonDto {
  @ApiProperty({ enum: STUCK_REASONS })
  @IsIn(STUCK_REASONS)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  reasonOther?: string;
}
