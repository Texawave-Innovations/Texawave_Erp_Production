import { Injectable } from "@nestjs/common";
import { IsInt, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsDateOnly, parseDateOnly } from "../../../common/dates/date-only.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { CalendarRepository, type CalendarDay } from "./calendar.repository.js";

export class QueryCalendarDayDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @ApiProperty({ example: "2026-10-02" })
  @IsDateOnly()
  date!: string;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  /** Visible only for employees the caller may read (own/team/all). */
  async day(query: QueryCalendarDayDto): Promise<CalendarDay> {
    const scope = await this.teamContext.resolveScope("hr.employee.read");
    const result = await this.repository.dayForVisibleEmployee(
      scope,
      query.employeeId,
      parseDateOnly(query.date),
    );
    if (!result)
      throw new ResourceNotFoundException("Employee", query.employeeId);
    return result;
  }
}

/**
 * Public, exported surface for OTHER modules (Attendance). Performs NO
 * own/team/all check — for trusted server-side callers that already
 * authorized the request; never expose it directly on a route. `date` must be
 * a date-only value (UTC midnight), see `parseDateOnly`. Read the caveat on
 * `CalendarDay.weeklyOffRules`: cross-scope precedence is not decided.
 */
@Injectable()
export class CalendarQueryService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  dayFor(employeeId: number, date: Date): Promise<CalendarDay | null> {
    return this.repository.dayForEmployee(
      this.tenantContext.getOrgScope(),
      employeeId,
      date,
    );
  }
}
