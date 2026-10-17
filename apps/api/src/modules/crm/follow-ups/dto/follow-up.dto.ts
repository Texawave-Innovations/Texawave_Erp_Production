import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import { ACTIVITY_TYPES } from "../../shared/activity-types.js";
import {
  RELATED_TYPES,
  type RelatedType,
} from "../../shared/related-entity.js";

/** Mirrors legacy `CrmFollowUpStatus` exactly. `OVERDUE` is never persisted
 * here (see `getEffectiveStatus` in the service) — only these 5 values are
 * ever written to the `status` column. */
export const FOLLOW_UP_STATUSES = [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "MISSED",
] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const FOLLOW_UP_PRIORITIES = ["High", "Medium", "Low"] as const;

export class CreateFollowUpDto {
  @IsIn(RELATED_TYPES)
  relatedType!: RelatedType;

  @IsInt()
  @Min(1)
  relatedId!: number;

  @IsIn(ACTIVITY_TYPES)
  type!: (typeof ACTIVITY_TYPES)[number];

  @IsDateString()
  scheduledAt!: string;

  @Trim()
  @IsString()
  @Length(1, 150)
  assignedTo!: string;

  @ApiPropertyOptional({ enum: FOLLOW_UP_PRIORITIES })
  @IsOptional()
  @IsIn(FOLLOW_UP_PRIORITIES)
  priority?: (typeof FOLLOW_UP_PRIORITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFollowUpDto extends PartialType(
  OmitType(CreateFollowUpDto, ["relatedType", "relatedId"] as const),
) {}

export class UpdateFollowUpStatusDto {
  @IsIn(FOLLOW_UP_STATUSES)
  status!: FollowUpStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;
}

export class RescheduleFollowUpDto {
  @IsDateString()
  newScheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class QueryFollowUpDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(RELATED_TYPES)
  relatedType?: RelatedType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  relatedId?: number;

  @ApiPropertyOptional({
    description:
      "Account roll-up: records of this account AND of its contacts and opportunities",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  rollupAccountId?: number;

  @ApiPropertyOptional({ enum: FOLLOW_UP_STATUSES })
  @IsOptional()
  @IsIn(FOLLOW_UP_STATUSES)
  status?: FollowUpStatus;
}
