import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";

const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/** A payment's own fields — "Record Payment" on an invoice, and the
 * Payments Received form (which also names the invoice). */
export class RecordPaymentDto {
  @ApiProperty({ example: 708, description: "≤ the invoice balance" })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999_999)
  amount!: number;

  @ApiProperty({ example: "2026-10-15" })
  @IsDateOnly()
  paymentDate!: string;

  @ApiPropertyOptional({
    example: "2026-11-15",
    description: "When the remaining balance is due; overdue after it",
  })
  @IsOptional()
  @IsDateOnly()
  dueDate?: string | null;

  @ApiPropertyOptional({
    example: 3,
    description:
      "A PAYMENT_MODE option of the Sales master list; its label is stored",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  modeItemId?: number | null;

  @ApiPropertyOptional({
    example: "Bank Transfer",
    description:
      "Typed mode, used when no modeItemId is sent. The old codes (CASH, BANK_TRANSFER, UPI, CHEQUE, CARD, OTHER) are stored as their labels.",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 50)
  mode?: string;

  @ApiPropertyOptional({ example: "UTR 1234567890" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  reference?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string | null;
}

export class CreatePaymentDto extends RecordPaymentDto {
  @ApiProperty({ example: 12, description: "The invoice being paid" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  invoiceId!: number;
}

/** The invoice cannot change — delete the payment and record it again. */
export class UpdatePaymentDto extends PartialType(RecordPaymentDto) {}

export class QueryPaymentDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Case-insensitive search on payment no, customer and invoice",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  invoiceId?: number;

  @ApiPropertyOptional({ example: "2026-10", description: "Payment month" })
  @IsOptional()
  @Matches(MONTH, { message: "paymentMonth must be YYYY-MM" })
  paymentMonth?: string;

  @ApiPropertyOptional({ example: "2026-11", description: "Due month" })
  @IsOptional()
  @Matches(MONTH, { message: "dueMonth must be YYYY-MM" })
  dueMonth?: string;

  @ApiPropertyOptional({ description: "Only overdue payments" })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  overdueOnly?: boolean;
}
