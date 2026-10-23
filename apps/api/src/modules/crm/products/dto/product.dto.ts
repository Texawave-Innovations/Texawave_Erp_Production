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
import { Trim } from "../../../../common/dto/transforms.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/Products.tsx
 * create/edit form. `name`/`code` are hard-required, matching legacy's
 * client-side save guard (`!form.name.trim() || !form.code.trim()`).
 * `code` is deliberately NOT checked for uniqueness here — approved
 * decision D1 (Docs/CRM_PRODUCTS_LEGACY_PARITY.md §4) preserves legacy's
 * actual behavior, which never enforces it on manual create/edit.
 * `unitPrice` rejects negative values (`@Min(0)`) — approved decision D3,
 * an intentional business-integrity safeguard that legacy itself does
 * not enforce server-side, not a parity requirement. `taxPercent` has no
 * upper bound, per D2. */
export class CreateProductDto {
  @ApiProperty({ example: "Industrial Woven Fabric Roll" })
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiProperty({ example: "SKU-1001" })
  @Trim()
  @IsString()
  @Length(1, 100)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  vendor?: string;

  @ApiProperty({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxPercent?: number;

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

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class QueryProductDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Matches name/code/category/vendor (case-insensitive)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;
}
