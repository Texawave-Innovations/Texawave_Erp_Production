import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  DocumentQueryDto,
  NextNumberQueryDto,
  PricedDocumentDto,
} from "./document-parts.dto.js";

export const INVOICE_TYPES = ["PROFORMA", "TAX"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "CONVERTED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_MODES = [
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "CHEQUE",
  "CARD",
  "OTHER",
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export class CreateInvoiceDto extends PricedDocumentDto {
  @ApiProperty({
    enum: INVOICE_TYPES,
    description: "PROFORMA → TW/PI/…, TAX → TW/IN/…; cannot change later",
  })
  @IsIn(INVOICE_TYPES)
  invoiceType!: InvoiceType;

  @ApiProperty({ example: "2026-10-15" })
  @IsDateOnly()
  invoiceDate!: string;

  @ApiPropertyOptional({ example: "2026-11-14", description: "≥ invoiceDate" })
  @IsOptional()
  @IsDateOnly()
  dueDate?: string | null;

  @ApiPropertyOptional({ example: "30 Days" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 50)
  paymentTerms?: string | null;
}

/** `lines`, when sent, replace every line. The total cannot drop below what
 * has already been received. */
export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ["invoiceType"] as const),
) {}

export class QueryInvoiceDto extends DocumentQueryDto {
  @ApiPropertyOptional({ enum: INVOICE_TYPES })
  @IsOptional()
  @IsIn(INVOICE_TYPES)
  invoiceType?: InvoiceType;

  @ApiPropertyOptional({ enum: INVOICE_STATUSES })
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;
}

export class ConvertQuotationDto {
  @ApiPropertyOptional({ enum: INVOICE_TYPES, default: "PROFORMA" })
  @IsOptional()
  @IsIn(INVOICE_TYPES)
  invoiceType?: InvoiceType;

  @ApiPropertyOptional({ example: "2026-10-15", description: "Default today" })
  @IsOptional()
  @IsDateOnly()
  invoiceDate?: string;
}

export class ConvertToTaxInvoiceDto {
  @ApiPropertyOptional({ example: "2026-10-15", description: "Default today" })
  @IsOptional()
  @IsDateOnly()
  invoiceDate?: string;
}

export class ConvertToDeliveryChallanDto {
  @ApiPropertyOptional({ example: "2026-10-15", description: "Default today" })
  @IsOptional()
  @IsDateOnly()
  dcDate?: string;
}

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

  @ApiProperty({ enum: PAYMENT_MODES })
  @IsIn(PAYMENT_MODES)
  mode!: PaymentMode;

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

export class NextInvoiceNumberQueryDto extends NextNumberQueryDto {
  @ApiProperty({ enum: INVOICE_TYPES })
  @IsIn(INVOICE_TYPES)
  invoiceType!: InvoiceType;
}
