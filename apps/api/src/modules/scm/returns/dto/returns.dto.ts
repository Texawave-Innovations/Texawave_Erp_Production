import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import {
  ALL_RETURN_STATUSES,
  RETURN_CONDITIONS,
  RETURN_DISPOSITIONS,
  RETURN_REASON_CODES,
  RETURN_TYPES,
} from "../returns.helpers.js";

export class CustomerReturnItemDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  requestedQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  serialNumbers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateCustomerReturnDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  fulfillmentId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  shipmentId?: number;

  @ApiProperty({ enum: RETURN_REASON_CODES })
  @IsIn(RETURN_REASON_CODES)
  reasonCode!: (typeof RETURN_REASON_CODES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  reasonDescription?: string;

  @ApiProperty({ type: [CustomerReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CustomerReturnItemDto)
  items!: CustomerReturnItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class VendorReturnItemDto {
  @ApiProperty({ description: "GRN line (item) id the goods came in on" })
  @IsInt()
  @Min(1)
  grnItemId!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  requestedQuantity!: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      "Required for serial-tracked lines: exactly requestedQuantity serials from the GRN line",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  serialNumbers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateVendorReturnDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  grnId!: number;

  @ApiProperty({ enum: RETURN_REASON_CODES })
  @IsIn(RETURN_REASON_CODES)
  reasonCode!: (typeof RETURN_REASON_CODES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  reasonDescription?: string;

  @ApiProperty({ type: [VendorReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => VendorReturnItemDto)
  items!: VendorReturnItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class ReturnReasonDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 1000)
  reason!: string;
}

export class OptionalReasonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  reason?: string;
}

export class ReturnShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  carrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  trackingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class ShipVendorReturnDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 150)
  carrier!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 100)
  trackingNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class ReceivedQuantityDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  itemId!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity!: number;
}

export class ReceiveReturnDto {
  @ApiPropertyOptional({ type: [ReceivedQuantityDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReceivedQuantityDto)
  receivedQuantities?: ReceivedQuantityDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class InspectionLineDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  itemId!: number;

  @ApiProperty({ enum: RETURN_CONDITIONS })
  @IsIn(RETURN_CONDITIONS)
  condition!: (typeof RETURN_CONDITIONS)[number];

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  acceptedQuantity!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  rejectedQuantity!: number;
}

export class CompleteReturnInspectionDto {
  @ApiProperty({ type: [InspectionLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InspectionLineDto)
  itemResults!: InspectionLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class DispositionDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  itemId!: number;

  @ApiProperty({ enum: RETURN_DISPOSITIONS })
  @IsIn(RETURN_DISPOSITIONS)
  disposition!: (typeof RETURN_DISPOSITIONS)[number];

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  locationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class QueryReturnDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: RETURN_TYPES })
  @IsOptional()
  @IsIn(RETURN_TYPES)
  returnType?: (typeof RETURN_TYPES)[number];

  @ApiPropertyOptional({ enum: ALL_RETURN_STATUSES })
  @IsOptional()
  @IsIn(ALL_RETURN_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: "Vendor returns against one supplier" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;
}
