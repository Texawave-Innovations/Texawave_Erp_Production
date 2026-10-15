import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

/**
 * Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/domain/
 * AddDealProductsDialog.tsx. `productId`/`quantity`/`discountPercent` are
 * the only caller-supplied fields — `productName`/`unitPrice`/
 * `taxPercent` are always snapshotted server-side from the live `Product`
 * row at add-time, never accepted from the request body, matching
 * legacy's picker exactly (it reads them off `product`, never lets the
 * user type them).
 */
export class AddOpportunityProductItemDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiProperty({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;
}

export class AddOpportunityProductsDto {
  @ApiProperty({ type: [AddOpportunityProductItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddOpportunityProductItemDto)
  items!: AddOpportunityProductItemDto[];
}

/** `productId`/`unitPrice`/`taxPercent`/`productName` are not editable —
 * the snapshot is intentionally frozen (Docs/CRM_PRODUCTS_LEGACY_PARITY.md
 * §2.7); only the fields the user actually entered at add-time can be
 * revised. */
export class UpdateOpportunityProductDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;
}
