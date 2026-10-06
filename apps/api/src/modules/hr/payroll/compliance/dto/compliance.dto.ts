import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { IsDateOnly } from "../../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export class UpdateEmployeePfProfileDto {
  @IsBoolean()
  pfApplicable!: boolean;

  @IsOptional()
  @IsString()
  uan?: string;

  @IsOptional()
  @IsString()
  pfNumber?: string;

  @IsOptional()
  @IsDateOnly()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;
}

export class UpdateEmployeeEsiProfileDto {
  @IsBoolean()
  esiApplicable!: boolean;

  @IsOptional()
  @IsString()
  insuranceNumber?: string;

  @IsOptional()
  @IsDateOnly()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;
}

export class QueryContributionDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  payrollPeriodId?: number;

  @IsOptional()
  @IsIn(["PENDING", "CREDITED", "FAILED"])
  paymentStatus?: "PENDING" | "CREDITED" | "FAILED";
}
