import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";

/** ISO weekday numbers: 1 = Monday … 7 = Sunday. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Sorts and de-duplicates so `[7, 6, 6]` is stored as `[6, 7]`; non-arrays
 * pass through for the validators to reject. */
const NormalizeDays = () =>
  Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? [...new Set(value as unknown[])].sort((a, b) => Number(a) - Number(b))
      : value,
  );

export class CreateWeeklyOffRuleDto {
  @ApiProperty({ example: "Saturday and Sunday off" })
  @Trim()
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: [6, 7],
    description:
      "ISO weekdays: 1 = Monday … 7 = Sunday. No day is assumed to be off — say which.",
  })
  @NormalizeDays()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(ISO_WEEKDAYS, { each: true })
  daysOfWeek!: number[];

  @ApiPropertyOptional({
    description:
      "Only this location (not together with teamId). Omit both for the whole organization.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workLocationId?: number;

  @ApiPropertyOptional({
    description: "Only this team (not together with workLocationId)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiProperty({
    example: "2026-01-01",
    description: "First day it applies (inclusive)",
  })
  @IsDateOnly()
  effectiveFrom!: string;

  @ApiPropertyOptional({
    example: "2026-12-31",
    description: "Last day (inclusive); omit for open-ended",
  })
  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;
}

/** Only the label changes in place. Days and dates are history: end the rule
 * and create a new one instead. */
export class UpdateWeeklyOffRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ description: "Send an empty string to clear" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class EndWeeklyOffRuleDto {
  @ApiProperty({
    example: "2026-12-31",
    description: "The last day the rule applies (inclusive)",
  })
  @IsDateOnly()
  effectiveTo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  reason?: string;
}

export class VoidWeeklyOffRuleDto {
  @ApiProperty({ description: "Why the rule was entered in error — mandatory" })
  @Trim()
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export const WEEKLY_OFF_SCOPES = ["organization", "location", "team"] as const;

export class QueryWeeklyOffRuleDto extends PaginationDto {
  @ApiPropertyOptional({ enum: WEEKLY_OFF_SCOPES })
  @IsOptional()
  @IsIn(WEEKLY_OFF_SCOPES)
  scope?: (typeof WEEKLY_OFF_SCOPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workLocationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiPropertyOptional({
    example: "2026-06-15",
    description: "Only rules covering this day",
  })
  @IsOptional()
  @IsDateOnly()
  activeOn?: string;

  @ApiPropertyOptional({
    description: "Include voided (entered-in-error) rules; default false",
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  includeVoided?: boolean;
}
