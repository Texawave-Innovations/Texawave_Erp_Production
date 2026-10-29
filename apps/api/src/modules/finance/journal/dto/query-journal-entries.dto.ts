import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  FINANCE_JOURNAL_ENTRY_STATUSES,
  FINANCE_JOURNAL_ENTRY_TYPES,
  type FinanceJournalEntryStatus,
  type FinanceJournalEntryType,
} from "../../finance.constants.js";

export class QueryJournalEntriesDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: FINANCE_JOURNAL_ENTRY_TYPES,
    description: "Filter by voucher entry classification",
  })
  @IsOptional()
  @IsIn(FINANCE_JOURNAL_ENTRY_TYPES)
  entryType?: FinanceJournalEntryType;

  @ApiPropertyOptional({
    enum: FINANCE_JOURNAL_ENTRY_STATUSES,
    description: "Filter by voucher status (DRAFT, POSTED, REVERSED, VOID)",
  })
  @IsOptional()
  @IsIn(FINANCE_JOURNAL_ENTRY_STATUSES)
  status?: FinanceJournalEntryStatus;

  @ApiPropertyOptional({
    example: "2026-10-01",
    description: "Filter entries from this date (inclusive)",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: "2026-10-31",
    description: "Filter entries up to this date (inclusive)",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Search in entryNumber, narration, or referenceNumber",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
