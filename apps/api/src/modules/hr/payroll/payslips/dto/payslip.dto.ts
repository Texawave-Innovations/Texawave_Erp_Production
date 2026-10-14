import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export class GeneratePayslipsDto {
  @Type(() => Number)
  @IsInt()
  payrollPeriodId!: number;

  /** Required only when an already generated payslip would change. */
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason?: string;
}

export class RegeneratePayslipDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class QueryPayslipDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  payrollPeriodId?: number;
}
