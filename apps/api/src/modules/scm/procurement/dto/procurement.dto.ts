import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";

export const REQUISITION_PRIORITIES = [
  "Low",
  "Normal",
  "High",
  "Urgent",
] as const;
export const REQUISITION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "CONVERTED",
] as const;
export const RFQ_STATUSES = [
  "DRAFT",
  "RESPONSES_PENDING",
  "PARTIALLY_RESPONDED",
  "RESPONDED",
  "CLOSED",
  "CANCELLED",
] as const;
export const QUOTATION_STATUSES = [
  "RECEIVED",
  "SHORTLISTED",
  "SELECTED",
  "REJECTED",
  "CANCELLED",
] as const;
export const PO_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
  "CLOSED",
] as const;

const CURRENCY = /^[A-Z]{3}$/;

class Qty {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty({ minimum: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

// ---- requisitions ---------------------------------------------------------

export class RequisitionItemDto extends Qty {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedUnitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requiredDate?: string;
}

export class RequisitionPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  department?: string;

  @ApiProperty({ example: "2026-10-18" })
  @IsDateString()
  requestDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requiredDate?: string;

  @ApiPropertyOptional({ enum: REQUISITION_PRIORITIES, default: "Normal" })
  @IsOptional()
  @IsIn(REQUISITION_PRIORITIES)
  priority?: (typeof REQUISITION_PRIORITIES)[number];

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: "Sales order that raised this shortage" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceSalesOrderId?: number;

  @ApiProperty({ type: [RequisitionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RequisitionItemDto)
  items!: RequisitionItemDto[];
}

export class RejectRequisitionDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 500)
  reason!: string;
}

export class QueryRequisitionDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      "Matches number/requester/purpose/department, or a linked PO's number/supplier",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: REQUISITION_STATUSES })
  @IsOptional()
  @IsIn(REQUISITION_STATUSES)
  status?: (typeof REQUISITION_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

// ---- RFQs -----------------------------------------------------------------

export class RfqItemDto extends Qty {}

export class CreateRfqDto {
  @ApiPropertyOptional({ description: "Approved requisition being converted" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requisitionId?: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  supplierIds!: number[];

  @ApiProperty()
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  responseDueDate?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  deliveryLocation?: string;

  @ApiPropertyOptional({ default: "INR" })
  @IsOptional()
  @UpperTrim()
  @Matches(CURRENCY, { message: "Currency must be a 3-letter ISO code" })
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  paymentTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  deliveryTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiProperty({ type: [RfqItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RfqItemDto)
  items!: RfqItemDto[];
}

export class QueryRfqDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: RFQ_STATUSES })
  @IsOptional()
  @IsIn(RFQ_STATUSES)
  status?: (typeof RFQ_STATUSES)[number];
}

// ---- supplier quotations --------------------------------------------------

export class QuotationItemDto extends Qty {
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  promisedDeliveryDate?: string;
}

export class CreateQuotationDto {
  @ApiPropertyOptional({
    description: "The supplier's own quotation reference",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  supplierQuotationNumber?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  rfqId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  supplierId!: number;

  @ApiProperty()
  @IsDateString()
  quotationDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ default: "INR" })
  @IsOptional()
  @UpperTrim()
  @Matches(CURRENCY, { message: "Currency must be a 3-letter ISO code" })
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  paymentTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  deliveryTerms?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  freight?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiProperty({ type: [QuotationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items!: QuotationItemDto[];
}

export class QueryQuotationDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: QUOTATION_STATUSES })
  @IsOptional()
  @IsIn(QUOTATION_STATUSES)
  status?: (typeof QUOTATION_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  rfqId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;
}

export class SaveComparisonDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  rfqId!: number;

  @ApiPropertyOptional({
    description: "Omit to save the comparison without deciding",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  selectedQuotationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  remarks?: string;
}

// ---- purchase orders ------------------------------------------------------

export class CreatePurchaseOrderDto {
  @ApiPropertyOptional({
    description:
      "Selected quotation to raise the PO from. Supplier and items are then taken from it.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  quotationId?: number;

  @ApiPropertyOptional({
    description:
      "Material Requisition this PO is raised against. It flips to CONVERTED once linked.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requisitionId?: number;

  @ApiPropertyOptional({ description: "Required unless quotationId is given" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiProperty()
  @IsDateString()
  poDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  deliveryLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  paymentTerms?: string;

  @ApiPropertyOptional({ default: "INR" })
  @IsOptional()
  @UpperTrim()
  @Matches(CURRENCY, { message: "Currency must be a 3-letter ISO code" })
  currency?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  freight?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiPropertyOptional({ type: [QuotationItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items?: QuotationItemDto[];
}

export class QueryPurchaseOrderDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: PO_STATUSES })
  @IsOptional()
  @IsIn(PO_STATUSES)
  status?: (typeof PO_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({ description: "Only POs raised from this requisition" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requisitionId?: number;

  @ApiPropertyOptional({
    description: "Only POs a GRN can be received against",
  })
  @IsOptional()
  @Trim()
  @IsString()
  receivable?: string;
}

// ---- goods receipts -------------------------------------------------------

export class GrnLineDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  purchaseOrderItemId!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivingQuantity!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejectedQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @UpperTrim()
  @IsString()
  @Length(0, 100)
  batchNumber?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  serialNumbers?: string[];

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: "Batch manufacturing date" })
  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @ApiPropertyOptional({ description: "Batch expiry date" })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateGoodsReceiptDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  purchaseOrderId!: number;

  @ApiProperty()
  @IsDateString()
  receiptDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiProperty({ type: [GrnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GrnLineDto)
  lines!: GrnLineDto[];
}

export class QueryGoodsReceiptDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  purchaseOrderId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;
}
