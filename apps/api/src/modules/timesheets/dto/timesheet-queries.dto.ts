import { ApiProperty } from "@nestjs/swagger";
import { IsDateOnly } from "../../../common/dates/date-only.js";

/** `:date` path parameter — a calendar date, `YYYY-MM-DD` (the IST work date). */
export class DayParamDto {
  @ApiProperty({ example: "2026-11-16" })
  @IsDateOnly()
  date!: string;
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
