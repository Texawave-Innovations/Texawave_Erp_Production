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
  FINANCE_BANK_TRANSACTION_TYPES,
  type FinanceBankTransactionType,
} from "../../finance.constants.js";

export class CreateBankTransactionDto {
  @ApiProperty({ description: "Target Bank Account ID" })
  @Type(() => Number)
  @IsInt()
  bankAccountId!: number;

  @ApiProperty({ description: "Transaction date (YYYY-MM-DD)" })
  @IsDateString()
  transactionDate!: string;

  @ApiProperty({ enum: FINANCE_BANK_TRANSACTION_TYPES })
  @IsIn(FINANCE_BANK_TRANSACTION_TYPES)
  transactionType!: FinanceBankTransactionType;

  @ApiProperty({ description: "Transaction amount (must be positive)" })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: "Description or memo for the transaction" })
  @IsString()
  @MaxLength(255)
  description!: string;

  @ApiPropertyOptional({ description: "UTR, cheque, or reference number" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional({
    description:
      "Counter GL Account ID to post balanced double-entry (e.g. Bank Charges Expense or Interest Revenue)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  counterGlAccountId?: number;
}
