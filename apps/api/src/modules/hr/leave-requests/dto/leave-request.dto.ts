import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";
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

// ---- HR actions on someone else's leave ----------------------------------

/** HR applies on an employee's behalf: the same fields as self-service, plus
 * the employee (who must be in the caller's `hr.leave_request.create` scope
 * and may not be the caller's own record). */
export class HrCreateLeaveRequestDto extends CreateLeaveRequestDto {
  @ApiProperty({ description: "Employee the leave is for (within your scope)" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;
}

export class HrCancelLeaveRequestDto {
  @ApiProperty({
    description: "Why HR cancels the leave — mandatory, shown to the employee",
  })
  @Trim()
  @IsString()
  @Length(3, 500)
  note!: string;
}

/** The caller's approval queue: always PENDING requests waiting for them. */
export class QueryAwaitingLeaveDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leaveTypeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional({ example: "2026-10-01" })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: "2026-10-31" })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({ enum: LEAVE_SORT_FIELDS, default: "startDate" })
  @IsOptional()
  @IsIn(LEAVE_SORT_FIELDS)
  sortBy?: (typeof LEAVE_SORT_FIELDS)[number];
}

// ---- export and balance report --------------------------------------------

/** Same filters as the list, without paging (an export is capped instead). */
export class ExportLeaveRequestQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional({ example: "2026-10-01" })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: "2026-10-31" })
  @IsOptional()
  @IsDateOnly()
  to?: string;
}

export class LeaveBalanceReportQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 2026, description: "Defaults to this year" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;

  @ApiPropertyOptional({ description: "Narrow to one team (within scope)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiPropertyOptional({ description: "Employee name or code" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  search?: string;
}

// ---- entitlement bulk / import --------------------------------------------

export class LeaveEntitlementItemDto extends SetLeaveEntitlementDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leaveTypeId!: number;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;
}

export const MAX_ENTITLEMENT_BATCH = 500;

export class BulkSetLeaveEntitlementsDto {
  @ApiProperty({
    type: [LeaveEntitlementItemDto],
    description: `1–${MAX_ENTITLEMENT_BATCH} entitlements, applied together or not at all`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ENTITLEMENT_BATCH)
  @ValidateNested({ each: true })
  @Type(() => LeaveEntitlementItemDto)
  items!: LeaveEntitlementItemDto[];
}

export class ImportLeaveEntitlementsQueryDto {
  @ApiPropertyOptional({
    description: "Check every row but save nothing",
    default: false,
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  dryRun?: boolean;
}

// ---- approval delegations -------------------------------------------------

export class CreateLeaveDelegationDto {
  @ApiProperty({ description: "User who may approve on your behalf" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  delegateUserId!: number;

  @ApiProperty({ example: "2026-10-20" })
  @IsDateOnly()
  startDate!: string;

  @ApiProperty({ example: "2026-10-31" })
  @IsDateOnly()
  endDate!: string;

  @ApiPropertyOptional({ example: "On leave" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 200)
  reason?: string;
}

export class QueryLeaveDelegationDto extends PaginationDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  activeOnly?: boolean;
}

export class DelegationCandidateQueryDto {
  @ApiPropertyOptional({ description: "Part of the name" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  search?: string;
}
