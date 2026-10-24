import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class PostSalesInvoiceDto {
  @ApiProperty({
    example: "INV-2026-001",
    description: "Sales invoice or sales order reference number",
  })
  @IsNotEmpty()
  @IsString()
  invoiceNumber!: string;

  @ApiProperty({
    example: "2026-10-15",
    description: "Invoice posting date (YYYY-MM-DD)",
  })
  @IsNotEmpty()
  @IsDateString()
  invoiceDate!: string;

  @ApiPropertyOptional({
    example: 101,
    description: "Customer database primary key ID",
  })
  @IsOptional()
  @IsInt()
  customerId?: number | null;

  @ApiProperty({
    example: "Acme Corp Ltd",
    description: "Customer legal/business name",
  })
  @IsNotEmpty()
  @IsString()
  customerName!: string;

  @ApiPropertyOptional({
    example: "29AABCT1332L1ZV",
    description: "Customer 15-character GSTIN if registered",
  })
  @IsOptional()
  @IsString()
  customerGstin?: string | null;

  @ApiProperty({
    example: 10000.0,
    description: "Invoice taxable subtotal amount before taxes in INR",
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  subtotal!: number;

  @ApiProperty({
    example: 1800.0,
    description: "Total tax amount (CGST + SGST + IGST) in INR",
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  taxAmount!: number;

  @ApiProperty({
    example: 11800.0,
    description: "Grand total invoice amount (subtotal + taxAmount) in INR",
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  total!: number;

  @ApiPropertyOptional({
    example: "INR",
    description: "ISO currency code (default: INR)",
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    example: "998314",
    description: "Primary HSN or SAC classification code",
  })
  @IsOptional()
  @IsString()
  hsnSacCode?: string | null;

  @ApiPropertyOptional({
    example: 900.0,
    description: "CGST tax component in INR",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cgstAmount?: number;

  @ApiPropertyOptional({
    example: 900.0,
    description: "SGST tax component in INR",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sgstAmount?: number;

  @ApiPropertyOptional({
    example: 0.0,
    description: "IGST tax component in INR",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  igstAmount?: number;

  @ApiPropertyOptional({
    example: "Professional IT services rendered for October 2026",
    description: "Invoice narration or description",
  })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({
    example: 12,
    description: "Originating ScmSalesOrder primary key ID if applicable",
  })
  @IsOptional()
  @IsInt()
  salesOrderId?: number | null;
}
