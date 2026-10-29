import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, Matches } from "class-validator";
import {
  FINANCE_GST_ENTRY_TYPES,
  type FinanceGstEntryType,
} from "../../finance.constants.js";

export class QueryHsnSummaryDto {
  @ApiPropertyOptional({
    example: "2026-10",
    description: "Tax period in YYYY-MM format",
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "Period must be in YYYY-MM format (e.g. 2026-10)",
  })
  period?: string;

  @ApiPropertyOptional({
    example: "2026-10-01",
    description: "Start date (inclusive) in YYYY-MM-DD format",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: "2026-10-31",
    description: "End date (inclusive) in YYYY-MM-DD format",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: FINANCE_GST_ENTRY_TYPES,
    description: "Filter by OUTPUT_GST or INPUT_TAX_CREDIT (default: all)",
  })
  @IsOptional()
  @IsIn(FINANCE_GST_ENTRY_TYPES)
  entryType?: FinanceGstEntryType;
}
