import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class QueryBalanceSheetDto {
  @ApiPropertyOptional({
    description:
      "As-of date for the Balance Sheet snapshot (YYYY-MM-DD). Defaults to today.",
  })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
