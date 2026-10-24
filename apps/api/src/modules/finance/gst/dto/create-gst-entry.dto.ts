import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from "class-validator";
import {
  FINANCE_GST_ENTRY_TYPES,
  FINANCE_GST_SOURCE_TYPES,
  type FinanceGstEntryType,
  type FinanceGstSourceType,
} from "../../finance.constants.js";

export class CreateGstEntryDto {
  @ApiProperty({
    example: "29AABCT1332L1ZV",
    description: "15-character GSTIN of the entity/vendor/customer",
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message:
      "Invalid GSTIN format. Expected standard 15-character Indian GSTIN.",
  })
  gstin!: string;

  @ApiProperty({
    example: "2026-10",
    description: "GST filing tax period in YYYY-MM format",
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "Period must be in YYYY-MM format (e.g. 2026-10)",
  })
  period!: string;

  @ApiProperty({
    enum: FINANCE_GST_ENTRY_TYPES,
    example: "OUTPUT_GST",
    description:
      "OUTPUT_GST for outward sales supplies, INPUT_TAX_CREDIT for purchase ITC",
  })
  @IsNotEmpty()
  @IsIn(FINANCE_GST_ENTRY_TYPES)
  entryType!: FinanceGstEntryType;

  @ApiProperty({
    enum: FINANCE_GST_SOURCE_TYPES,
    example: "SALES_INVOICE",
    description: "Originating source voucher type",
  })
  @IsNotEmpty()
  @IsIn(FINANCE_GST_SOURCE_TYPES)
  sourceType!: FinanceGstSourceType;

  @ApiPropertyOptional({
    example: 105,
    description: "Originating entity primary key ID in database if applicable",
  })
  @IsOptional()
  @IsInt()
  sourceId?: number | null;

  @ApiProperty({
    example: "TEXA/INV/2026/001",
    description: "Invoice or bill reference number",
  })
  @IsNotEmpty()
  @IsString()
  sourceReference!: string;

  @ApiPropertyOptional({
    example: "998314",
    description: "HSN or SAC 6/8-digit goods/services tax classification code",
  })
  @IsOptional()
  @IsString()
  hsnSacCode?: string | null;

  @ApiProperty({
    example: 10000.0,
    description: "Taxable base value before taxes in INR",
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  taxableAmount!: number;

  @ApiPropertyOptional({
    example: 9.0,
    description: "CGST tax rate percentage (e.g. 9 for 9%)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cgstRate?: number;

  @ApiPropertyOptional({
    example: 900.0,
    description: "CGST tax amount in INR",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cgstAmount?: number;

  @ApiPropertyOptional({
    example: 9.0,
    description: "SGST tax rate percentage (e.g. 9 for 9%)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sgstRate?: number;

  @ApiPropertyOptional({
    example: 900.0,
    description: "SGST tax amount in INR",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sgstAmount?: number;

  @ApiPropertyOptional({
    example: 0.0,
    description: "IGST tax rate percentage (e.g. 18 for interstate)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  igstRate?: number;

  @ApiPropertyOptional({
    example: 0.0,
    description: "IGST tax amount in INR",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  igstAmount?: number;

  @ApiPropertyOptional({
    example: 1800.0,
    description: "Total tax amount (CGST + SGST + IGST) in INR",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalTaxAmount?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      "Whether this entry represents a proforma invoice excluded from returns",
  })
  @IsOptional()
  @IsBoolean()
  isProformaExcluded?: boolean;
}
