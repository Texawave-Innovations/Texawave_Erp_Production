import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PaginationDto } from "../../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../../common/dto/transforms.js";
import {
  MONTH_LOCK_FILTERS,
  MONTH_PATTERN,
  type MonthLockFilter,
} from "../month-lock.rules.js";

/** Most employees one finalize or bulk approve may touch. */
export const MAX_MONTH_LOCK_BATCH = 500;

export class QueryAttendanceMonthLocksDto extends PaginationDto {
  @ApiProperty({ example: "2026-09", description: "Calendar month, YYYY-MM" })
  @Matches(MONTH_PATTERN, { message: "month must be YYYY-MM" })
  month!: string;

  @ApiPropertyOptional({ enum: MONTH_LOCK_FILTERS })
  @IsOptional()
  @IsIn(MONTH_LOCK_FILTERS)
  status?: MonthLockFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;
}

export class FinalizeAttendanceMonthDto {
  @ApiProperty({ example: "2026-09" })
  @Matches(MONTH_PATTERN, { message: "month must be YYYY-MM" })
  month!: string;

  @ApiPropertyOptional({
    type: [Number],
    description:
      "Employees to submit. Omit to submit every eligible employee in your scope (narrowed by teamId).",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MONTH_LOCK_BATCH)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  employeeIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  teamId?: number;
}

export class ApproveAttendanceMonthDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(1000)
  note?: string;
}

export class BulkApproveAttendanceMonthsDto extends ApproveAttendanceMonthDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MONTH_LOCK_BATCH)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}

/** Returning or reopening a month always says why (DB CHECK too). */
export class ReasonedAttendanceMonthDecisionDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @Trim()
  @MinLength(3)
  @MaxLength(1000)
  note!: string;
}
