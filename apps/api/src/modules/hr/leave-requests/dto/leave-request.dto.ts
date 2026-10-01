import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
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

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/**
 * Whole days only (half-days are unapproved policy). There is deliberately NO
 * `employeeId`: a submission is always for the authenticated user's own
 * employee record, resolved server-side from the JWT.
 */
export class CreateLeaveRequestDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leaveTypeId!: number;

  @ApiProperty({
    example: "2026-10-05",
    description: "First day of leave (inclusive)",
  })
  @IsDateOnly()
  startDate!: string;

  @ApiProperty({
    example: "2026-10-07",
    description: "Last day of leave (inclusive); same as startDate for one day",
  })
  @IsDateOnly()
  endDate!: string;

  @ApiProperty({
    description: "Why — visible to whoever may read/approve the request",
  })
  @Trim()
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class ApproveLeaveRequestDto {
  @ApiPropertyOptional({ description: "Optional note to the employee" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  note?: string;
}

export class RejectLeaveRequestDto {
  @ApiProperty({ description: "Why the request is rejected — mandatory" })
  @Trim()
  @IsString()
  @Length(3, 500)
  note!: string;
}

export const LEAVE_SORT_FIELDS = ["startDate", "createdAt", "status"] as const;

class LeaveRequestFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LEAVE_STATUSES })
  @IsOptional()
  @IsIn(LEAVE_STATUSES)
  status?: LeaveStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leaveTypeId?: number;

  @ApiPropertyOptional({
    example: "2026-10-01",
    description: "Requests whose range reaches this day or later",
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    example: "2026-10-31",
    description: "Requests whose range starts on or before this day",
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({ enum: LEAVE_SORT_FIELDS, default: "startDate" })
  @IsOptional()
  @IsIn(LEAVE_SORT_FIELDS)
  sortBy?: (typeof LEAVE_SORT_FIELDS)[number];
}

export class QueryLeaveRequestDto extends LeaveRequestFilterDto {
  @ApiPropertyOptional({
    description: "History of one employee (within your scope)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}

/** Self-service list: always the caller's own requests — no employeeId. */
export class QueryMyLeaveRequestDto extends LeaveRequestFilterDto {}
