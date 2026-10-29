import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  FINANCE_PAYMENT_MADE_STATUSES,
  type FinancePaymentMadeStatus,
} from "../../finance.constants.js";

export class QueryPaymentsMadeDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Filter by payment mode ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  paymentModeId?: number;

  @ApiPropertyOptional({ description: "Filter by bank account ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bankAccountId?: number;

  @ApiPropertyOptional({ enum: FINANCE_PAYMENT_MADE_STATUSES })
  @IsOptional()
  @IsIn(FINANCE_PAYMENT_MADE_STATUSES)
  status?: FinancePaymentMadeStatus;

  @ApiPropertyOptional({
    description: "Filter payments on or after this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter payments on or before this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      "Search by vendor name, payment number, reference, or bill reference",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
