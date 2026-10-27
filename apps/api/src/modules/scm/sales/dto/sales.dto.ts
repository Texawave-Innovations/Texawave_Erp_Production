import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";

export const SALES_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "CANCELLED",
  "CLOSED",
] as const;
export const CUSTOMER_STATUSES = ["Active", "Inactive"] as const;
const present = (_: unknown, v: unknown) =>
  v !== undefined && v !== null && v !== "";

export class CreateCustomerDto {
  @ApiPropertyOptional({ description: "Allocated (CUST-NNNN) when omitted" })
  @IsOptional()
  @UpperTrim()
  @IsString()
  @Length(1, 50)
  customerCode?: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @ValidateIf(present)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @UpperTrim()
  @ValidateIf(present)
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: "Invalid GSTIN format",
  })
  gstin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  billingAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  shippingAddress?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: (typeof CUSTOMER_STATUSES)[number];
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class QueryCustomerDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: (typeof CUSTOMER_STATUSES)[number];
}

export class SalesOrderItemDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty({ minimum: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;
}

export class CreateSalesOrderDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  customerId!: number;

  @ApiProperty()
  @IsDateString()
  orderDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({
    description: "Defaults to the customer's shipping address",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  shipToAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  billToAddress?: string;

  @ApiPropertyOptional({ default: "INR" })
  @IsOptional()
  @UpperTrim()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiProperty({ type: [SalesOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items!: SalesOrderItemDto[];
}

export class QuerySalesOrderDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: SALES_ORDER_STATUSES })
  @IsOptional()
  @IsIn(SALES_ORDER_STATUSES)
  status?: (typeof SALES_ORDER_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}

export class IssueSalesInvoiceDto {
  @ApiPropertyOptional({
    example: "2026-10-26",
    description: "Tax invoice date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({
    example: "TW/INV/26-27/0001",
    description: "Custom invoice number override",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 50)
  customInvoiceNumber?: string;

  @ApiPropertyOptional({
    description: "Optional notes printed on invoice and journal narration",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional({
    enum: ["INTRA_STATE", "INTER_STATE"],
    description:
      "Explicit tax jurisdiction override: INTRA_STATE or INTER_STATE",
  })
  @IsOptional()
  @IsIn(["INTRA_STATE", "INTER_STATE"])
  jurisdiction?: "INTRA_STATE" | "INTER_STATE";
}
