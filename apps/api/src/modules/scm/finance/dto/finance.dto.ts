import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  BILL_STATUSES,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
} from "../finance.helpers.js";

// ---- bills ------------------------------------------------------------------

export class CreateBillDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  supplierId!: number;

  @ApiPropertyOptional({ description: "The supplier's own invoice number" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  supplierBillNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  purchaseOrderId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  goodsReceiptId?: number;

  @ApiProperty({ example: "2026-10-18" })
  @IsDateString()
  billDate!: string;

  @ApiPropertyOptional({
    description: "Derived from the supplier's payment terms when omitted",
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class UpdateBillDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  supplierBillNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  billDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class ReasonDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 1000)
  reason!: string;
}

export class QueryBillDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Matches bill number / supplier invoice / supplier",
  })
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: BILL_STATUSES })
  @IsOptional()
  @IsIn(BILL_STATUSES)
  status?: (typeof BILL_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({ description: "Only unpaid bills past their due date" })
  @IsOptional()
  @IsIn(["true", "false"])
  overdue?: string;
}

// ---- payments -----------------------------------------------------------------

export class CreatePaymentDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  supplierId!: number;

  @ApiPropertyOptional({
    description:
      "Bill this payment settles; omit for an advance / on-account payment",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  billId?: number;

  @ApiProperty({ example: "2026-10-18" })
  @IsDateString()
  paymentDate!: string;

  @ApiProperty({ enum: PAYMENT_MODES })
  @IsIn(PAYMENT_MODES)
  mode!: (typeof PAYMENT_MODES)[number];

  @ApiPropertyOptional({ description: "UTR / cheque number / transaction id" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  referenceNumber?: string;

  @ApiProperty({ minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class QueryPaymentDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  billId?: number;

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];
}

// ---- documents ----------------------------------------------------------------

/** Multipart form fields alongside the uploaded file. */
export class UploadSupplierDocumentDto {
  @ApiPropertyOptional({
    description: "Display name; defaults to the uploaded file's name",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  documentType?: string;
}
