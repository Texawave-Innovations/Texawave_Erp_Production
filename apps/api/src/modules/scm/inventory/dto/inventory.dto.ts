import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
import {
  QueryBoolean,
  Trim,
  UpperTrim,
} from "../../../../common/dto/transforms.js";
import { LEDGER_TRANSACTION_TYPES } from "../stock-posting.service.js";

export const ADJUSTMENT_DIRECTIONS = ["IN", "OUT"] as const;
export const TRANSFER_STATUSES = [
  "DRAFT",
  "REQUESTED",
  "APPROVED",
  "IN_TRANSIT",
  "RECEIVED",
  "CANCELLED",
] as const;
export const ADJUSTMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const RESERVATION_STATUSES = [
  "ACTIVE",
  "RELEASED",
  "FULFILLED",
  "CANCELLED",
] as const;
export const BATCH_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "QUARANTINED",
  "BLOCKED",
] as const;
export const SERIAL_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "TRANSFERRED",
  "DAMAGED",
  "RETURNED",
  "QUARANTINED",
] as const;
export const STOCK_STATUSES = [
  "Out of Stock",
  "Low Stock",
  "Healthy",
  "Overstock",
] as const;

class PositiveQty {
  @ApiProperty({ minimum: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class OpeningBalanceDto extends PositiveQty {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateReservationDto extends PositiveQty {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesOrderId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class ReleaseReservationDto {
  @ApiProperty({ enum: ["RELEASED", "CANCELLED"] })
  @IsIn(["RELEASED", "CANCELLED"])
  status!: "RELEASED" | "CANCELLED";
}

export class CreateTransferDto extends PositiveQty {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  sourceWarehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceLocationId?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  destinationWarehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  destinationLocationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateAdjustmentDto extends PositiveQty {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @ApiProperty({ enum: ADJUSTMENT_DIRECTIONS })
  @IsIn(ADJUSTMENT_DIRECTIONS)
  direction!: (typeof ADJUSTMENT_DIRECTIONS)[number];

  @ApiProperty({
    description:
      "Must be an active scm.master_list_item value in the stock_adjustment_reason category",
  })
  @Trim()
  @IsString()
  @Length(1, 200)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateBatchDto {
  @ApiProperty()
  @UpperTrim()
  @IsString()
  @Length(1, 100)
  batchNumber!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @ApiPropertyOptional({ example: "2026-04-01" })
  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @ApiPropertyOptional({ example: "2027-04-01" })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class UpdateBatchStatusDto {
  @ApiProperty({ enum: BATCH_STATUSES })
  @IsIn(BATCH_STATUSES)
  status!: (typeof BATCH_STATUSES)[number];
}

export class CreateSerialsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  serialNumbers!: string[];
}

export class UpdateSerialStatusDto {
  @ApiProperty({ enum: SERIAL_STATUSES })
  @IsIn(SERIAL_STATUSES)
  status!: (typeof SERIAL_STATUSES)[number];
}

export class QueryOverviewDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Matches product code/name/category" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional({ enum: STOCK_STATUSES })
  @IsOptional()
  @IsIn(STOCK_STATUSES)
  stockStatus?: (typeof STOCK_STATUSES)[number];

  @ApiPropertyOptional({
    description: "Only rows holding rejected / bad (damaged) units",
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  hasBadStock?: boolean;
}

export class QueryLedgerDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Matches reference number / notes" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional({ enum: LEDGER_TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(LEDGER_TRANSACTION_TYPES)
  transactionType?: (typeof LEDGER_TRANSACTION_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Shared by reservations / transfers / adjustments / batches / serials lists. */
export class QueryInventoryDocsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 40)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  expiringSoon?: boolean;
}
