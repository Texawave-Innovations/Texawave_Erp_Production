import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Matches, Min } from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { MISSING_PUNCH_TYPES } from "../reports/attendance-report-rules.js";

/** A date range with optional narrowing. Narrowing is always within the
 * caller's scope; it cannot widen it. */
export class RangeAttendanceReportQueryDto extends PaginationDto {
  @ApiProperty({ example: "2026-10-01" })
  @IsDateOnly()
  from!: string;

  @ApiProperty({ example: "2026-10-31" })
  @IsDateOnly()
  to!: string;

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

export class MissingPunchReportQueryDto extends RangeAttendanceReportQueryDto {
  @ApiPropertyOptional({ enum: MISSING_PUNCH_TYPES })
  @IsOptional()
  @IsIn(MISSING_PUNCH_TYPES)
  type?: (typeof MISSING_PUNCH_TYPES)[number];
}

export class DailyAttendanceReportQueryDto extends PaginationDto {
  @ApiProperty({ example: "2026-10-05" })
  @IsDateOnly()
  date!: string;
}

export class MonthlyAttendanceReportQueryDto extends PaginationDto {
  @ApiProperty({ example: "2026-10", description: "Calendar month, YYYY-MM" })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;
}

/** A calendar month with the same optional narrowing as the range reports. */
export class FullMonthPresentReportQueryDto extends MonthlyAttendanceReportQueryDto {
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
