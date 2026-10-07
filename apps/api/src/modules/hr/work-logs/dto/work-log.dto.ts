import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const WORK_LOG_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type WorkLogStatus = (typeof WORK_LOG_STATUSES)[number];

/** There is deliberately NO `employeeId`: a submission is always for the
 * authenticated user's own employee record, resolved server-side from the JWT. */
export class CreateWorkLogDto {
  @ApiProperty({
    example: "2026-10-05",
    description: "The day the work was done",
  })
  @IsDateOnly()
  workDate!: string;

  @ApiProperty({
    example: 7.5,
    description: "Hours worked that day; greater than 0 and at most 24",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(24)
  hoursWorked!: number;

  @ApiProperty({ description: "What was worked on" })
  @Trim()
  @IsString()
  @Length(3, 500)
  taskDescription!: string;
}

/** The note is optional: the legacy screen has no decision note. */
export class DecideWorkLogDto {
  @ApiPropertyOptional({ description: "Optional note to the employee" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  note?: string;
}

class WorkLogFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: WORK_LOG_STATUSES })
  @IsOptional()
  @IsIn(WORK_LOG_STATUSES)
  status?: WorkLogStatus;

  @ApiPropertyOptional({
    example: "2026-10-01",
    description: "Logs on or after this day",
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    example: "2026-10-31",
    description: "Logs on or before this day",
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;
}

/** HR/approver list: scoped by `hr.work_log.read`. */
export class QueryWorkLogDto extends WorkLogFilterDto {
  @ApiPropertyOptional({ description: "Logs of one employee (within scope)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}

/** Self-service list: always the caller's own logs — no employeeId. */
export class QueryMyWorkLogDto extends WorkLogFilterDto {}

/** Approver queue: logs of the caller's direct reports. */
export class QueryWorkLogApprovalsDto extends WorkLogFilterDto {}
