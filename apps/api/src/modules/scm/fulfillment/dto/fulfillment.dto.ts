import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const FULFILLMENT_STATUSES = [
  "PENDING",
  "PARTIALLY_AVAILABLE",
  "AVAILABLE",
  "RESERVED",
  "PICKING",
  "PACKING",
  "READY_TO_SHIP",
  "FULFILLED",
  "CANCELLED",
  "ON_HOLD",
] as const;
export const PICK_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "PARTIALLY_PICKED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const PACK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PACKED",
  "CANCELLED",
] as const;
export const FULFILLMENT_VIEWS = [
  "allocation",
  "reserved",
  "backorders",
  "active",
] as const;

export class CreateFulfillmentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  salesOrderId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;
}

export class CancelFulfillmentDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 500)
  reason!: string;
}

export class QueryFulfillmentDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: FULFILLMENT_STATUSES })
  @IsOptional()
  @IsIn(FULFILLMENT_STATUSES)
  status?: (typeof FULFILLMENT_STATUSES)[number];

  @ApiPropertyOptional({
    enum: FULFILLMENT_VIEWS,
    description:
      "allocation = awaiting reservation; reserved = holding stock; backorders = open with a shortage; active = not closed",
  })
  @IsOptional()
  @IsIn(FULFILLMENT_VIEWS)
  view?: (typeof FULFILLMENT_VIEWS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesOrderId?: number;
}

export class PickProgressItemDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  pickingItemId!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pickedQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceLocationId?: number;
}

export class RecordPickDto {
  @ApiProperty({ type: [PickProgressItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PickProgressItemDto)
  items!: PickProgressItemDto[];

  @ApiPropertyOptional({
    description: "Complete a pick that cannot be fully picked",
  })
  @IsOptional()
  @IsBoolean()
  closeShort?: boolean;
}

export class AssignPickerDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 150)
  pickerName!: string;
}

export class PackageItemDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;
}

export class PackageDto {
  @ApiProperty({ example: "PKG-1" })
  @Trim()
  @IsString()
  @Length(1, 60)
  packageNumber!: string;

  @ApiPropertyOptional({ example: "Box" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 60)
  packageType?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  length?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  height?: number;

  @ApiProperty({ type: [PackageItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PackageItemDto)
  items!: PackageItemDto[];
}

export class CreatePackingDto {
  @ApiProperty({ description: "A COMPLETED pick list" })
  @Type(() => Number)
  @IsInt()
  pickingId!: number;

  @ApiProperty({ type: [PackageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PackageDto)
  packages!: PackageDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  packerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class QueryPickingDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: PICK_STATUSES })
  @IsOptional()
  @IsIn(PICK_STATUSES)
  status?: (typeof PICK_STATUSES)[number];

  @ApiPropertyOptional({
    description: "COMPLETED picks not yet packed or issued",
  })
  @IsOptional()
  @Trim()
  @IsString()
  packable?: string;
}

export class QueryPackingDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: PACK_STATUSES })
  @IsOptional()
  @IsIn(PACK_STATUSES)
  status?: (typeof PACK_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fulfillmentId?: number;
}
