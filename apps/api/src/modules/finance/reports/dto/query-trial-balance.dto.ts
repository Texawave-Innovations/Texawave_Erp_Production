import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class QueryTrialBalanceDto {
  @ApiPropertyOptional({
    description:
      "As-of date for the Trial Balance (YYYY-MM-DD). Defaults to today.",
  })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional({
    description:
      "Start date for period movement calculations (YYYY-MM-DD). Defaults to start of current month.",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "End date for period movement calculations (YYYY-MM-DD). Defaults to today.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
