import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class UpdateExpenseDto {
  @ApiPropertyOptional({
    example: 1,
    description: "ID of active expense type in Finance Master List",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  expenseTypeId?: number;

  @ApiPropertyOptional({
    example: "2026-10-23",
    description: "Date when expense was incurred (ISO YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional({
    example: 2500.0,
    description: "Subtotal / gross expense amount before taxes",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    example: 450.0,
    description: "Tax / GST amount applied to the expense",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "ID of active payment mode in Finance Master List",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  paymentModeId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "ID of company bank account used for disbursement",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  bankAccountId?: number;

  @ApiPropertyOptional({
    example: 10,
    description: "Chart of Accounts GL Account ID to debit for the expense",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  glAccountId?: number;

  @ApiPropertyOptional({
    example: "Acme Office Supplies Ltd",
    description: "Name of the third-party merchant or vendor",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 255)
  vendorName?: string;

  @ApiPropertyOptional({
    example: "Printer paper, toner cartridges, and desk accessories",
    description: "Internal notes or purpose of the expense",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ApiPropertyOptional({
    example: "https://storage.texawave.com/receipts/rec-98231.pdf",
    description: "URL or attachment reference to original tax invoice/bill",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 500)
  receiptUrl?: string;
}
