import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Matches, Min } from "class-validator";
import { IsDateOnly } from "../../../common/dates/date-only.js";

/** `:date` path parameter — a calendar date, `YYYY-MM-DD` (the IST work date). */
export class DayParamDto {
  @ApiProperty({ example: "2026-11-16" })
  @IsDateOnly()
  date!: string;
}

/** `month` query parameter — a calendar month, `YYYY-MM`. */
export class MonthQueryDto {
  @ApiProperty({ example: "2026-08" })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "month must be a calendar month, YYYY-MM",
  })
  month!: string;
}

/** `:employeeId` path parameter of a reviewer's employee views. */
export class EmployeeParamDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;
}

/** Date range of a task's day history (inclusive, at most 62 days). */
export class TaskHistoryQueryDto {
  @ApiProperty({ example: "2026-11-16" })
  @IsDateOnly()
  from!: string;

  @ApiProperty({ example: "2026-11-19" })
  @IsDateOnly()
  to!: string;
}
