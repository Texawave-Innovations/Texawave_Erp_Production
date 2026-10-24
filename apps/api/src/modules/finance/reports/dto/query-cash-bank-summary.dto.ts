import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class QueryCashBankSummaryDto {
  @ApiPropertyOptional({
    description:
      "Start date of the summary period (YYYY-MM-DD). Defaults to the start of current month.",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "End date of the summary period (YYYY-MM-DD). Defaults to today.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
