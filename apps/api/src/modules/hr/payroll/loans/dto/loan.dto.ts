import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export const LOAN_STATUSES = [
  "ACTIVE",
  "CLOSED",
  "DEFAULTED",
  "CANCELLED",
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export class CreateLoanDto {
  @Type(() => Number)
  @IsInt()
  employeeId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  principalAmount!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  emiAmount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  emiMonths!: number;

  @IsDateOnly()
  disbursedDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateLoanSkipRequestDto {
  @Type(() => Number)
  @IsInt()
  payrollPeriodId!: number;

  @IsString()
  reason!: string;
}

export class DecideLoanSkipRequestDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";
}

export class QueryLoanDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsIn(LOAN_STATUSES)
  status?: LoanStatus;
}
