import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export const BONUS_TYPES = [
  "FESTIVAL",
  "PERFORMANCE",
  "STATUTORY",
  "ANNUAL",
  "SPOT",
] as const;
export type BonusType = (typeof BONUS_TYPES)[number];

export const BONUS_STATUSES = [
  "PENDING",
  "APPROVED",
  "PROCESSED",
  "REJECTED",
] as const;
export type BonusStatus = (typeof BONUS_STATUSES)[number];

export class CreateBonusDto {
  @Type(() => Number)
  @IsInt()
  employeeId!: number;

  @IsIn(BONUS_TYPES)
  bonusType!: BonusType;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  calculationBase?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tenureMonths?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  attendanceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  payrollPeriodId?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class DecideBonusDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryBonusDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  payrollPeriodId?: number;

  @IsOptional()
  @IsIn(BONUS_STATUSES)
  status?: BonusStatus;
}
