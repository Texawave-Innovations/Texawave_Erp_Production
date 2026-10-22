import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";

export const WAREHOUSE_TYPES = [
  "Main",
  "Regional",
  "Transit",
  "Virtual",
  "Other",
  "Distribution",
  "Fulfillment",
  "Returns",
] as const;
export const ACTIVE_STATUSES = ["Active", "Inactive"] as const;
export const LOCATION_TYPES = ["ZONE", "RACK", "SHELF", "BIN"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

/** Parent type each location type must sit inside (a ZONE's parent is the
 * warehouse itself). Ported from legacy `VALID_PARENT_TYPE`. */
export const VALID_PARENT_TYPE: Record<LocationType, LocationType | null> = {
  ZONE: null,
  RACK: "ZONE",
  SHELF: "RACK",
  BIN: "SHELF",
};

const present = (_: unknown, v: unknown) =>
  v !== undefined && v !== null && v !== "";

export class CreateWarehouseDto {
  @ApiProperty({ example: "WH01" })
  @UpperTrim()
  @IsString()
  @Length(1, 30)
  code!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional({ enum: WAREHOUSE_TYPES, default: "Main" })
  @IsOptional()
  @IsIn(WAREHOUSE_TYPES)
  type?: (typeof WAREHOUSE_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  managerName?: string;

  @ApiPropertyOptional({ enum: ACTIVE_STATUSES, default: "Active" })
  @IsOptional()
  @IsIn(ACTIVE_STATUSES)
  status?: (typeof ACTIVE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  contactPerson?: string;

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

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  capacityUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  operatingHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}

export class QueryWarehouseDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Matches code/name/city" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: ACTIVE_STATUSES })
  @IsOptional()
  @IsIn(ACTIVE_STATUSES)
  status?: (typeof ACTIVE_STATUSES)[number];
}

export class CreateLocationDto {
  @ApiProperty()
  @IsInt()
  @Type(() => Number)
  warehouseId!: number;

  @ApiProperty({ enum: LOCATION_TYPES })
  @IsIn(LOCATION_TYPES)
  locationType!: LocationType;

  @ApiPropertyOptional({
    description: "Required for RACK/SHELF/BIN; omitted for a ZONE",
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentLocationId?: number;

  @ApiProperty({ example: "Z01" })
  @UpperTrim()
  @IsString()
  @Length(1, 50)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  locationName?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  capacityUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class UpdateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  locationName?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  capacityUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiPropertyOptional({ enum: ACTIVE_STATUSES })
  @IsOptional()
  @IsIn(ACTIVE_STATUSES)
  status?: (typeof ACTIVE_STATUSES)[number];
}

export class QueryLocationDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional({ enum: LOCATION_TYPES })
  @IsOptional()
  @IsIn(LOCATION_TYPES)
  locationType?: LocationType;
}
