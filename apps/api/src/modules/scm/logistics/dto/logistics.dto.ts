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
  IsUrl,
  Length,
  Min,
  ValidateIf,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";

export const SHIPMENT_STATUSES = [
  "READY_TO_SHIP",
  "CARRIER_ASSIGNED",
  "LABEL_CREATED",
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_EXCEPTION",
  "FAILED_DELIVERY",
  "CANCELLED",
] as const;
const present = (_: unknown, v: unknown) =>
  v !== undefined && v !== null && v !== "";

export class CreateCarrierDto {
  @ApiProperty({ example: "BLUEDART" })
  @UpperTrim()
  @IsString()
  @Length(1, 50)
  carrierCode!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 150)
  carrierName!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  contact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @ValidateIf(present)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @ValidateIf(present)
  @IsUrl({ require_protocol: true })
  website?: string;

  @ApiPropertyOptional({
    example: "https://track.example.com/{trackingNumber}",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  trackingUrlTemplate?: string;

  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class UpdateCarrierDto extends PartialType(CreateCarrierDto) {}

export class QueryCarrierDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}

export class CreateShipmentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  fulfillmentId!: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Type(() => Number)
  packingIds!: number[];
}

export class AssignCarrierDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  carrierId!: number;

  @ApiProperty()
  @Trim()
  @IsString()
  serviceType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCost?: number;
}

export class ShipmentLabelDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 100)
  trackingNumber!: string;
}

export class ShipmentStatusUpdateDto {
  @ApiProperty({ enum: ["IN_TRANSIT", "OUT_FOR_DELIVERY"] })
  @IsIn(["IN_TRANSIT", "OUT_FOR_DELIVERY"])
  status!: "IN_TRANSIT" | "OUT_FOR_DELIVERY";

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  description?: string;
}

export class DeliverShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  recipientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  deliveryNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @ValidateIf(present)
  @IsUrl({ require_protocol: true })
  proofOfDeliveryUrl?: string;
}

export class RecordExceptionDto {
  @ApiProperty()
  @Trim()
  @IsString()
  exceptionCode!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 1000)
  description!: string;
}

export class ResolveExceptionDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 1000)
  resolution!: string;
}

export class ReasonDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 500)
  reason!: string;
}

export class QueryShipmentDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: SHIPMENT_STATUSES })
  @IsOptional()
  @IsIn(SHIPMENT_STATUSES)
  status?: (typeof SHIPMENT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  carrierId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fulfillmentId?: number;
}
