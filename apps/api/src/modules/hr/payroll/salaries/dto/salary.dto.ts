import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Min } from "class-validator";
import { IsDateOnly } from "../../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export class CreateSalaryDto {
  @Type(() => Number)
  @IsInt()
  employeeId!: number;

  @IsDateOnly()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;

  /** Give `basic` and `hra` (and optionally the other components), or omit
   * both and give `grossMonthly` to have it split by the organization's
   * payroll settings (hr/payroll/settings). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basic?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  conveyance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  specialAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arrearsSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossMonthly?: number;
}

export class UpdateSalaryDto {
  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basic?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  conveyance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  specialAllowance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arrearsSalary?: number;
}

export class QuerySalaryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsDateOnly()
  effectiveOn?: string;
}
