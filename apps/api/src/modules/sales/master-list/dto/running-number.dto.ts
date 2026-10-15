import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Matches, Max, Min } from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";

const FISCAL_YEAR = /^[0-9]{2}-[0-9]{2}$/;

export class RunningNumbersQueryDto {
  @ApiPropertyOptional({
    example: "2026-10-15",
    description: "Show the financial year this date falls in (default today)",
  })
  @IsOptional()
  @IsDateOnly()
  date?: string;
}

/** Set the last number used; the next document gets `lastNumber + 1`. */
export class SetRunningNumberDto {
  @ApiProperty({
    example: 100,
    description: "TW/QUO/26-27/0100 → the next quotation is TW/QUO/26-27/0101",
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99_999_999)
  lastNumber!: number;

  @ApiPropertyOptional({
    example: "26-27",
    description: "Financial year (April–March); default the current one",
  })
  @IsOptional()
  @Matches(FISCAL_YEAR, { message: "fiscalYear must look like 26-27" })
  fiscalYear?: string;
}
