import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  FINANCE_EXPENSE_STATUSES,
  type FinanceExpenseStatus,
} from "../../finance.constants.js";

export class QueryExpensesDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 1,
    description: "Filter by expense category/type ID",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expenseTypeId?: number;

  @ApiPropertyOptional({
    example: 2,
    description: "Filter by payment mode ID",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  paymentModeId?: number;

  @ApiPropertyOptional({
    enum: FINANCE_EXPENSE_STATUSES,
    description:
      "Filter by expense status (DRAFT, PENDING_APPROVAL, APPROVED, PAID, CANCELLED)",
  })
  @IsOptional()
  @IsIn(FINANCE_EXPENSE_STATUSES)
  status?: FinanceExpenseStatus;

  @ApiPropertyOptional({
    example: "2026-10-01",
    description: "Filter expenses incurred on or after this date (inclusive)",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: "2026-10-31",
    description: "Filter expenses incurred on or before this date (inclusive)",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Search in expenseNumber, vendorName, or notes",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
