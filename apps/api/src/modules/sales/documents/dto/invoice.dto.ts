import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length } from "class-validator";
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

export class NextInvoiceNumberQueryDto extends NextNumberQueryDto {
  @ApiProperty({ enum: INVOICE_TYPES })
  @IsIn(INVOICE_TYPES)
  invoiceType!: InvoiceType;
}
