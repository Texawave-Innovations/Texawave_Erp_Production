import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
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

/** SCM product master. Replaces the legacy reconciliation of the Sales
 * module's dual-shape product records; inventory-owned per-SKU settings
 * (reorder/min/max, cost, batch/serial tracking) live on the same row. */
export class CreateScmProductDto {
  @ApiProperty({ example: "SKU-1001" })
  @UpperTrim()
  @IsString()
  @Length(1, 100)
  productCode!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  category?: string;

  @ApiPropertyOptional({ default: "PCS" })
  @IsOptional()
  @UpperTrim()
  @IsString()
  @Length(1, 20)
  uom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  hsn?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorderLevel?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumStock?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maximumStock?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  batchTracked?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  serialTracked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateScmProductDto extends PartialType(CreateScmProductDto) {}

export class QueryScmProductDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Matches code/name/category/HSN" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isActive?: boolean;
}
