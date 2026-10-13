import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { IsDateOnly } from "../../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export const LOAN_STATUSES = [
  "PENDING_APPROVAL",
  "ACTIVE",
  "REJECTED",
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

  /** Required when the principal exceeds the organization's limit
   * (`loanMaxMultiple` × gross monthly); such a loan then needs an
   * organization-wide (`.all`) approver. */
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  overrideReason?: string;
}

export class DecideLoanDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  /** Mandatory when rejecting. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
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

export class CreateLoanPrepaymentDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  @IsDateOnly()
  receivedOn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class DecideLoanPrepaymentDto {
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
