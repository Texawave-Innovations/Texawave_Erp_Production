import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { IsDateOnly } from "../../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export const PERIOD_STATUSES = [
  "DRAFT",
  "PROCESSING",
  "PROCESSED",
  "APPROVED",
  "FINALIZED",
  "REOPENED",
  "CANCELLED",
] as const;
export type PayrollPeriodStatus = (typeof PERIOD_STATUSES)[number];

export class CreatePayrollPeriodDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsOptional()
  @IsDateOnly()
  periodStart?: string;

  @IsOptional()
  @IsDateOnly()
  periodEnd?: string;
}

export class UpdatePayrollPeriodDto {
  @IsOptional()
  @IsIn(["DRAFT", "CANCELLED"])
  status?: "DRAFT" | "CANCELLED";
}

export class QueryPayrollPeriodDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsIn(PERIOD_STATUSES)
  status?: PayrollPeriodStatus;
}

/** Why a finalized month is reopened — mandatory, kept on the period and in
 * the audit trail. */
export class ReopenPayrollPeriodDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
