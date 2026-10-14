import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const CORRECTION_TYPES = [
  "MISSED_CHECK_IN",
  "MISSED_CHECK_OUT",
  "INCORRECT_TIME",
  "LATE_ARRIVAL",
  "EARLY_DEPARTURE",
] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const CORRECTION_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

/** There is deliberately NO employee field: a correction is always for the
 * authenticated user's own employee record, resolved from the JWT. */
export class SubmitAttendanceCorrectionDto {
  @ApiProperty({ example: "2026-10-05" })
  @IsDateOnly()
  attendanceDate!: string;

  @ApiProperty({ enum: CORRECTION_TYPES })
  @IsIn(CORRECTION_TYPES)
  correctionType!: CorrectionType;

  @ApiPropertyOptional({
    example: "2026-10-05T04:30:00.000Z",
    description: "The corrected check-in instant (ISO 8601 with offset)",
  })
  @IsOptional()
  @IsDateString()
  requestedCheckInAt?: string;

  @ApiPropertyOptional({ example: "2026-10-05T13:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  requestedCheckOutAt?: string;

  @ApiProperty({
    description: "Why — visible to whoever may decide the request",
  })
  @Trim()
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class QueryAttendanceCorrectionDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CORRECTION_STATUSES })
  @IsOptional()
  @IsIn(CORRECTION_STATUSES)
  status?: CorrectionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}

export class ApproveAttendanceCorrectionDto {
  @ApiPropertyOptional({ description: "Optional note to the employee" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  note?: string;
}

export class RejectAttendanceCorrectionDto {
  @ApiProperty({ description: "Why the correction is rejected — mandatory" })
  @Trim()
  @IsString()
  @Length(3, 500)
  note!: string;
}
