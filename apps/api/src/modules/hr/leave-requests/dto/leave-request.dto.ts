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
import {
  DAY_PORTIONS,
  type DayPortion,
  LEAVE_STATUSES,
  type LeaveStatus,
} from "../leave-domain.js";

export { DAY_PORTIONS, LEAVE_STATUSES };
export type { DayPortion, LeaveStatus };

/**
 * There is deliberately NO `employeeId`: a submission is always for the
 * authenticated user's own employee record, resolved server-side from the JWT.
 * A half-day (FIRST_HALF / SECOND_HALF) must name a single date.
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

  @ApiPropertyOptional({
    enum: DAY_PORTIONS,
    default: "FULL",
    description: "Half-days require startDate = endDate",
  })
  @IsOptional()
  @IsIn(DAY_PORTIONS)
  dayPortion?: DayPortion;

  @ApiProperty({
    description: "Why — visible to whoever may read/approve the request",
  })
  @Trim()
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class CancelLeaveRequestDto {
  @ApiPropertyOptional({ description: "Optional note for the record" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  note?: string;
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

export class SetLeaveEntitlementDto {
  @ApiProperty({
    example: 12,
    nullable: true,
    description:
      "Annual days for this employee, leave type and year. null removes the override so the leave type default applies again.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(366)
  annualEntitlement!: number | null;
}

export class LeaveBalanceQueryDto {
  @ApiPropertyOptional({
    description: "Balance year. Defaults to the current year.",
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;
}

export class HrLeaveBalanceQueryDto extends LeaveBalanceQueryDto {
  @ApiProperty({
    description: "Employee whose balances to read (within your scope)",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;
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
