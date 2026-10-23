import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const QUOTA_PERIODS = ["monthly", "quarterly"] as const;
export const QUOTA_METRICS = ["revenue", "closedWonValue", "dealsWon"] as const;

/** Mirrors legacy `CrmQuotaInput` (domain/types.ts). `periodKey` format
 * (YYYY-MM / YYYY-Q#) is validated in the service against `period`. */
export class CreateCrmQuotaDto {
  @Trim()
  @IsString()
  @Length(1, 150)
  repName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  team?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  managerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  targetOwner?: string;

  @IsIn(QUOTA_PERIODS)
  period!: (typeof QUOTA_PERIODS)[number];

  @Trim()
  @IsString()
  @Length(1, 20)
  periodKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999999999)
  targetAmount!: number;

  @ApiPropertyOptional({ enum: QUOTA_METRICS })
  @IsOptional()
  @IsIn(QUOTA_METRICS)
  metric?: (typeof QUOTA_METRICS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 10)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class UpdateCrmQuotaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 150)
  repName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  team?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  managerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  targetOwner?: string;

  @ApiPropertyOptional({ enum: QUOTA_PERIODS })
  @IsOptional()
  @IsIn(QUOTA_PERIODS)
  period?: (typeof QUOTA_PERIODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 20)
  periodKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999999999)
  targetAmount?: number;

  @ApiPropertyOptional({ enum: QUOTA_METRICS })
  @IsOptional()
  @IsIn(QUOTA_METRICS)
  metric?: (typeof QUOTA_METRICS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 10)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class QueryCrmQuotaDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Case/whitespace-insensitive rep match" })
  @IsOptional()
  @Trim()
  @IsString()
  repName?: string;

  @ApiPropertyOptional({ enum: QUOTA_PERIODS })
  @IsOptional()
  @IsIn(QUOTA_PERIODS)
  period?: (typeof QUOTA_PERIODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  periodKey?: string;
}

/** Draft for the Set-Target form's live summary panel (nothing persisted). */
export class QuotaLiveSummaryDto {
  @Trim()
  @IsString()
  @Length(1, 150)
  repName!: string;

  @IsIn(QUOTA_PERIODS)
  period!: (typeof QUOTA_PERIODS)[number];

  @Trim()
  @IsString()
  @Length(1, 20)
  periodKey!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  targetAmount!: number;

  @ApiPropertyOptional({ enum: QUOTA_METRICS })
  @IsOptional()
  @IsIn(QUOTA_METRICS)
  metric?: (typeof QUOTA_METRICS)[number];
}
