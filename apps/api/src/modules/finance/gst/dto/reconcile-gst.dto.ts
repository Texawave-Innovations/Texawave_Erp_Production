import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

export class CounterpartGstEntryDto {
  @ApiProperty({
    example: "29AABCT1332L1ZV",
    description: "Vendor or supplier GSTIN",
  })
  @IsNotEmpty()
  @IsString()
  gstin!: string;

  @ApiProperty({
    example: "INV-2026-901",
    description: "Vendor invoice number as filed in portal return",
  })
  @IsNotEmpty()
  @IsString()
  invoiceNumber!: string;

  @ApiPropertyOptional({
    example: "2026-10-15",
    description: "Invoice date as reported by vendor",
  })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiProperty({
    example: 10000.0,
    description: "Taxable value reported on portal",
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  taxableAmount!: number;

  @ApiPropertyOptional({
    example: 900.0,
    description: "CGST tax amount reported on portal",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cgstAmount?: number;

  @ApiPropertyOptional({
    example: 900.0,
    description: "SGST tax amount reported on portal",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sgstAmount?: number;

  @ApiPropertyOptional({
    example: 0.0,
    description: "IGST tax amount reported on portal",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  igstAmount?: number;

  @ApiProperty({
    example: 1800.0,
    description: "Total tax amount reported on portal",
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  totalTaxAmount!: number;
}

export class ReconcileGstDto {
  @ApiProperty({
    example: "2026-10",
    description: "GST tax period to reconcile (YYYY-MM)",
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "Period must be in YYYY-MM format (e.g. 2026-10)",
  })
  period!: string;

  @ApiPropertyOptional({
    example: true,
    description:
      "Whether to persist RECONCILED status on matching database entries",
  })
  @IsOptional()
  @IsBoolean()
  persistReconciliation?: boolean;

  @ApiProperty({
    type: [CounterpartGstEntryDto],
    description:
      "Counterpart GSTR-2B or vendor filing records to match against ERP purchase books",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CounterpartGstEntryDto)
  counterpartEntries!: CounterpartGstEntryDto[];
}
