import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  FINANCE_GST_ENTRY_TYPES,
  FINANCE_GST_SOURCE_TYPES,
  FINANCE_GST_STATUSES,
  type FinanceGstEntryType,
  type FinanceGstSourceType,
  type FinanceGstStatus,
} from "../../finance.constants.js";

export class QueryGstEntriesDto extends PaginationDto {
  @ApiPropertyOptional({
    example: "2026-10",
    description: "Filter by tax period (YYYY-MM)",
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "Period must be in YYYY-MM format (e.g. 2026-10)",
  })
  period?: string;

  @ApiPropertyOptional({
    enum: FINANCE_GST_ENTRY_TYPES,
    description:
      "Filter by GST entry classification (OUTPUT_GST / INPUT_TAX_CREDIT)",
  })
  @IsOptional()
  @IsIn(FINANCE_GST_ENTRY_TYPES)
  entryType?: FinanceGstEntryType;

  @ApiPropertyOptional({
    enum: FINANCE_GST_SOURCE_TYPES,
    description: "Filter by originating source type",
  })
  @IsOptional()
  @IsIn(FINANCE_GST_SOURCE_TYPES)
  sourceType?: FinanceGstSourceType;

  @ApiPropertyOptional({
    enum: FINANCE_GST_STATUSES,
    description:
      "Filter by GST record status (ACTIVE, FILED, RECONCILED, CANCELLED)",
  })
  @IsOptional()
  @IsIn(FINANCE_GST_STATUSES)
  status?: FinanceGstStatus;

  @ApiPropertyOptional({
    example: "998314",
    description: "Filter by HSN or SAC code",
  })
  @IsOptional()
  @IsString()
  hsnSacCode?: string;

  @ApiPropertyOptional({
    example: "29AABCT1332L1ZV",
    description: "Filter by GSTIN",
  })
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiPropertyOptional({
    description: "Search in sourceReference or gstin",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
