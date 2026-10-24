import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  FINANCE_BANK_TRANSACTION_TYPES,
  type FinanceBankTransactionType,
} from "../../finance.constants.js";

export class QueryBankTransactionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Filter by bank account ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bankAccountId?: number;

  @ApiPropertyOptional({ enum: FINANCE_BANK_TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(FINANCE_BANK_TRANSACTION_TYPES)
  transactionType?: FinanceBankTransactionType;

  @ApiPropertyOptional({ description: "Filter by reconciliation status" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isReconciled?: boolean;

  @ApiPropertyOptional({
    description: "Filter transactions on or after this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter transactions on or before this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Search by description or reference number",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
