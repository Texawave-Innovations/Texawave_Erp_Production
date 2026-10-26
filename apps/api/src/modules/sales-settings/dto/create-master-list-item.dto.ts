import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { Trim } from "../../../common/dto/transforms.js";
import {
  SALES_MASTER_LIST_CATEGORIES,
  type SalesMasterListCategory,
} from "../sales-settings.constants.js";

/** Backs all 8 Terms & Inventory cards (Payment Terms, Delivery Terms,
 * Dispatch Modes, GST Rates, Item Categories, Item Types, Item Groups,
 * Units) — `category` picks which card a row belongs to. Values are NOT
 * unique per category: the reference UI shows two identical "9%" GST Rate
 * entries, so this is an unstructured value list, not a code+name lookup. */
export class CreateMasterListItemDto {
  @ApiProperty({ enum: SALES_MASTER_LIST_CATEGORIES })
  @IsIn(SALES_MASTER_LIST_CATEGORIES)
  category!: SalesMasterListCategory;

  @ApiProperty({ example: "Immediately" })
  @Trim()
  @IsString()
  @Length(1, 200)
  value!: string;

  @ApiPropertyOptional({
    description:
      "Used by category = gst_rate (the percentage); null for others",
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
