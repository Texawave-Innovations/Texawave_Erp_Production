import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class QueryProfitAndLossDto {
  @ApiPropertyOptional({
    description:
      "Start date of the reporting period (YYYY-MM-DD). Defaults to the start of current month.",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "End date of the reporting period (YYYY-MM-DD). Defaults to today.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
