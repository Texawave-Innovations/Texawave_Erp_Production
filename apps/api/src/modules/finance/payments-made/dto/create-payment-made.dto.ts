import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import {
  FINANCE_PAYMENT_MADE_STATUSES,
  type FinancePaymentMadeStatus,
} from "../../finance.constants.js";

export class CreatePaymentMadeDto {
  @ApiPropertyOptional({
    description:
      "Custom payment voucher number (e.g. PM-202610-0001). Auto-generated if omitted.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentNumber?: string;

  @ApiProperty({ description: "Payment disbursement date (YYYY-MM-DD)" })
  @IsDateString()
  paymentDate!: string;

  @ApiProperty({ description: "Recipient vendor or supplier name" })
  @IsString()
  @MaxLength(150)
  vendorName!: string;

  @ApiProperty({ description: "Disbursement amount (positive number)" })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: "Payment mode master list item ID" })
  @Type(() => Number)
  @IsInt()
  paymentModeId!: number;

  @ApiPropertyOptional({ description: "Source Finance Bank Account ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bankAccountId?: number;

  @ApiPropertyOptional({
    description: "Cheque, UTR, or transaction reference number",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional({
    description:
      "Purchase bill reference or supplier invoice number (e.g. BILL-202610-0012)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  billReference?: string;

  @ApiPropertyOptional({ description: "Linked ScmSupplierPayment ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scmSupplierPaymentId?: number;

  @ApiPropertyOptional({ description: "Internal notes or remarks" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: FINANCE_PAYMENT_MADE_STATUSES,
    default: "CONFIRMED",
    description:
      "Initial status (CONFIRMED automatically creates and posts GL journal voucher)",
  })
  @IsOptional()
  @IsIn(FINANCE_PAYMENT_MADE_STATUSES)
  status?: FinancePaymentMadeStatus = "CONFIRMED";
}
