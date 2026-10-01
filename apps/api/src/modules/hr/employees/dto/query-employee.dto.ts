import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";
import {
  EMPLOYEE_STATUSES,
  type EmployeeStatus,
} from "../employee-status.policy.js";

export const EMPLOYEE_SORT_FIELDS = [
  "employeeCode",
  "fullName",
  "dateOfJoining",
  "status",
  "createdAt",
] as const;

export class QueryEmployeeDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Case-insensitive match on code, name or work e-mail",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES })
  @IsOptional()
  @IsIn(EMPLOYEE_STATUSES)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employmentTypeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workLocationId?: number;

  @ApiPropertyOptional({ description: "Direct reports of this employee" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reportsToId?: number;

  @ApiPropertyOptional({ description: "Whether a login account is linked" })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  hasUser?: boolean;

  @ApiPropertyOptional({
    example: "2026-01-01",
    description: "Joined on/after (inclusive)",
  })
  @IsOptional()
  @IsDateOnly()
  joinedFrom?: string;

  @ApiPropertyOptional({
    example: "2026-12-31",
    description: "Joined on/before (inclusive)",
  })
  @IsOptional()
  @IsDateOnly()
  joinedTo?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_SORT_FIELDS, default: "employeeCode" })
  @IsOptional()
  @IsIn(EMPLOYEE_SORT_FIELDS)
  sortBy?: (typeof EMPLOYEE_SORT_FIELDS)[number];
}
