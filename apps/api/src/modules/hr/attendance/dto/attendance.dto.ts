import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { STORED_STATUSES } from "../services/attendance-calculation.service.js";

/** Largest from→to window a list endpoint accepts. Keeps a single request
 * bounded regardless of how many employees the caller can see. */
export const MAX_RANGE_DAYS = 62;
export const MAX_SESSIONS_PER_DAY = 20;

/** Self-service check-in and check-out take no body on purpose: the server
 * stamps the time and resolves the employee from the JWT. */

export class QueryMyAttendanceDto extends PaginationDto {
  @ApiProperty({ example: "2026-10-01" })
  @IsDateOnly()
  from!: string;

  @ApiProperty({ example: "2026-10-31" })
  @IsDateOnly()
  to!: string;
}

export class QueryAttendanceDto extends QueryMyAttendanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional({
    enum: STORED_STATUSES,
    description:
      "Filters on the STORED status only. Derived statuses (holiday, weekly off, leave, not marked) are shown by the daily report, not filterable here.",
  })
  @IsOptional()
  @IsIn(STORED_STATUSES)
  status?: (typeof STORED_STATUSES)[number];
}

export class ManualSessionDto {
  @ApiProperty({ example: "2026-10-05T04:30:00.000Z" })
  @IsDateString()
  checkInAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "null leaves the session open (at most one open session per day)",
  })
  @IsOptional()
  @IsDateString()
  checkOutAt?: string | null;
}

/** HR manual edit. Fields are optional; omitting one leaves it unchanged.
 * `sessions` REPLACES the day's punches (send [] to clear them). The replaced
 * punches are kept in the audit trail. There is deliberately no employee,
 * organization or date field: this endpoint cannot move a record. */
export class ManualAttendanceEditDto {
  @ApiPropertyOptional({
    enum: [...STORED_STATUSES, null],
    nullable: true,
    description: "null clears the stored status (the day is derived again)",
  })
  @IsOptional()
  @IsIn(STORED_STATUSES)
  status?: (typeof STORED_STATUSES)[number] | null;

  @ApiPropertyOptional({ type: [ManualSessionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SESSIONS_PER_DAY)
  @ValidateNested({ each: true })
  @Type(() => ManualSessionDto)
  sessions?: ManualSessionDto[];
}
