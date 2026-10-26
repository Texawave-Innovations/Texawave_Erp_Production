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
  MOVEMENT_STATUSES,
  PUTAWAY_STATUSES,
} from "../warehouse-ops.helpers.js";

export class CreatePutawayDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  warehouseId!: number;

  @ApiPropertyOptional({ description: "Pre-fills lines from a COMPLETED GRN" })
  @IsOptional()
  @IsInt()
  @Min(1)
  grnId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class RecordPutawayItemDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  destinationLocationId!: number;
}

export class QueryPutawayDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: PUTAWAY_STATUSES })
  @IsOptional()
  @IsIn(PUTAWAY_STATUSES)
  status?: (typeof PUTAWAY_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  warehouseId?: number;
}

export class MovementItemDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sourceLocationId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  destinationLocationId!: number;
}

export class CreateMovementDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  warehouseId!: number;

  @ApiProperty({ type: [MovementItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MovementItemDto)
  items!: MovementItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class QueryMovementDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: MOVEMENT_STATUSES })
  @IsOptional()
  @IsIn(MOVEMENT_STATUSES)
  status?: (typeof MOVEMENT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  warehouseId?: number;
}

export class ReasonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  reason?: string;
}

export class QueryLocationStockDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;
}

export class QueryActivityDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;
}

export class StockViewQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @ApiPropertyOptional({
    description: "Matches product code/name or location code",
  })
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;
}

/** Write a quantity of stock off from one bin (or the unassigned bucket). */
export class StockWriteOffDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  warehouseId!: number;

  @ApiPropertyOptional({
    description: "Omit for the warehouse's unassigned stock",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  locationId?: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
