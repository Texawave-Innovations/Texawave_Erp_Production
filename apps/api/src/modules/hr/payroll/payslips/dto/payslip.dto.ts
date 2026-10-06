import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";

export class GeneratePayslipsDto {
  @Type(() => Number)
  @IsInt()
  payrollPeriodId!: number;
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
