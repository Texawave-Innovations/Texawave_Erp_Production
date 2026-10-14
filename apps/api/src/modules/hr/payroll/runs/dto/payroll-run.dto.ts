import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export const RUN_STATUSES = [
  "DRAFT",
  "PROCESSING",
  "PROCESSED",
  "APPROVED",
  "CANCELLED",
] as const;
export type PayrollRunStatus = (typeof RUN_STATUSES)[number];

export class CreatePayrollRunDto {
  @Type(() => Number)
  @IsInt()
  payrollPeriodId!: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  employeeIds?: number[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApprovePayrollRunDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryPayrollRunDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  payrollPeriodId?: number;

  @IsOptional()
  @IsIn(RUN_STATUSES)
  status?: PayrollRunStatus;
}

export class QueryPayrollEntryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  payrollRunId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  payrollPeriodId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
