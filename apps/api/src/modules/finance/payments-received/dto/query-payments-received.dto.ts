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
  FINANCE_PAYMENT_RECEIVED_STATUSES,
  type FinancePaymentReceivedStatus,
} from "../../finance.constants.js";

export class QueryPaymentsReceivedDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 10,
    description: "Filter by customer (CRM Account ID)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  customerId?: number;

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
    example: 1,
    description: "Filter by company bank account ID",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  bankAccountId?: number;

  @ApiPropertyOptional({
    enum: FINANCE_PAYMENT_RECEIVED_STATUSES,
    description:
      "Filter by receipt status (DRAFT, CONFIRMED, RECONCILED, VOID)",
  })
  @IsOptional()
  @IsIn(FINANCE_PAYMENT_RECEIVED_STATUSES)
  status?: FinancePaymentReceivedStatus;

  @ApiPropertyOptional({
    example: "2026-10-01",
    description: "Filter payments received on or after this date (inclusive)",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: "2026-10-31",
    description: "Filter payments received on or before this date (inclusive)",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      "Search in paymentNumber, customerName, referenceNumber, or notes",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
