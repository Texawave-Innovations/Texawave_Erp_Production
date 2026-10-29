import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Min,
} from "class-validator";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";
import { GSTIN_PATTERN } from "./create-expense.dto.js";

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
    example: "33AAMCT4293K1ZU",
    description: "15-character GSTIN of the vendor if registered under GST",
  })
  @IsOptional()
  @UpperTrim()
  @IsString()
  @Matches(GSTIN_PATTERN, {
    message:
      "Invalid GSTIN format. Expected standard 15-character Indian GSTIN.",
  })
  vendorGstin?: string;

  @ApiPropertyOptional({
    example: "INV-2026-9081",
    description: "Vendor's tax invoice or bill reference number",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  vendorInvoiceNumber?: string;

  @ApiPropertyOptional({
    example: "2026-10-20",
    description: "Vendor invoice date (ISO YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  vendorInvoiceDate?: string;

  @ApiPropertyOptional({
    example: "998311",
    description: "HSN / SAC classification code for the supply",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 20)
  hsnSacCode?: string;

  @ApiPropertyOptional({
    example: 18,
    default: 0,
    description: "GST tax rate percentage (0, 5, 12, 18, 28)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({
    example: 90.0,
    default: 0,
    description: "Central GST amount (for intra-state supplies)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cgstAmount?: number;

  @ApiPropertyOptional({
    example: 90.0,
    default: 0,
    description: "State / UT GST amount (for intra-state supplies)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sgstAmount?: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: "Integrated GST amount (for inter-state supplies)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  igstAmount?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      "Whether the input tax is eligible for ITC. Set to false if credit is blocked under Section 17(5)",
  })
  @IsOptional()
  @IsBoolean()
  isItcEligible?: boolean;

  @ApiPropertyOptional({
    example: "Motor vehicles / Personal consumption (Sec 17(5))",
    description: "Mandatory justification if ITC is marked ineligible",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 255)
  ineligibilityReason?: string;

  @ApiPropertyOptional({
    enum: ["INTRA_STATE", "INTER_STATE"],
    description:
      "GST tax jurisdiction override. If omitted, determined by vendor and company GSTIN state codes.",
  })
  @IsOptional()
  @IsIn(["INTRA_STATE", "INTER_STATE"])
  gstJurisdiction?: "INTRA_STATE" | "INTER_STATE";

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
