import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  SCM_MASTER_LIST_CATEGORIES,
  type ScmMasterListCategory,
} from "../scm-master-list-items.constants.js";

/** Backs all SCM Master cards (Supplier Types, Package Types, Warehouse
 * Types, Stock Adjustment Reasons) — `category` picks which card a row
 * belongs to. Values are NOT unique per category — an unstructured value
 * list, same shape as
 * apps/api/src/modules/sales-settings/dto/create-master-list-item.dto.ts. */
export class CreateMasterListItemDto {
  @ApiProperty({ enum: SCM_MASTER_LIST_CATEGORIES })
  @IsIn(SCM_MASTER_LIST_CATEGORIES)
  category!: ScmMasterListCategory;

  @ApiProperty({ example: "Manufacturer" })
  @Trim()
  @IsString()
  @Length(1, 200)
  value!: string;

  @ApiPropertyOptional({
    description: "Reserved for a future numeric-backed category; null today",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  numericValue?: number;

  @ApiPropertyOptional({
    description: "Arbitrary extra fields, not queried/filtered/joined",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
