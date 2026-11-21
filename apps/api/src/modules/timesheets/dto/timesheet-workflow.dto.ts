import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { IsDateOnly } from "../../../common/dates/date-only.js";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

/** Submit every day of the week that holds `weekStart` (the ISO week, Mon–Sun). */
export class SubmitWeekDto {
  @ApiProperty({ example: "2026-11-16", description: "Any date in the week" })
  @IsDateOnly()
  weekStart!: string;
}

/** Approve takes an optional note; reject requires one (checked in the rules). */
export class ReviewDecisionDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReviewDayParamDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @ApiProperty({ example: "2026-11-16" })
  @IsDateOnly()
  date!: string;
}

/** `drafts=true` also returns a day the employee has not submitted (read-only). */
export class ReviewDayQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === "true" || value === true,
  )
  @IsBoolean()
  drafts?: boolean;
}

export const REVIEW_LIST_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

export class ReviewListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: REVIEW_LIST_STATUSES })
  @IsOptional()
  @IsIn(REVIEW_LIST_STATUSES)
  status?: (typeof REVIEW_LIST_STATUSES)[number];

  @ApiPropertyOptional({ example: "2026-11-01" })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: "2026-11-30" })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}

export class AwaitingQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}

/** HR confirms the real end of a session that was closed with no time counted. */
export class CorrectSessionDto {
  @ApiProperty({
    example: "17:30",
    description: "IST HH:mm on the session's day",
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "endTime must be a valid HH:mm time",
  })
  endTime!: string;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class SessionParamDto {
  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sessionId!: number;
}

/** Date range of a report (inclusive, at most 62 days). */
export class ReportQueryDto {
  @ApiProperty({ example: "2026-11-01" })
  @IsDateOnly()
  from!: string;

  @ApiProperty({ example: "2026-11-30" })
  @IsDateOnly()
  to!: string;

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
  employeeId?: number;
}
