import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";

export class QueryGeneralLedgerDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter by specific Chart of Accounts ID",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  accountId?: number;

  @ApiPropertyOptional({
    description: "Filter by specific Chart of Accounts code (e.g. 1020, 2010)",
  })
  @IsOptional()
  @IsString()
  accountCode?: string;

  @ApiPropertyOptional({
    description:
      "Start date of the ledger period (YYYY-MM-DD). Defaults to the start of current month.",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "End date of the ledger period (YYYY-MM-DD). Defaults to today.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
