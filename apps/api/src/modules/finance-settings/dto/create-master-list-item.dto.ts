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
  FINANCE_MASTER_LIST_CATEGORIES,
  type FinanceMasterListCategory,
} from "../finance-settings.constants.js";

/** Backs both Finance Master cards (Expense Types, Payment Modes) —
 * `category` picks which card a row belongs to. Values are NOT unique per
 * category — an unstructured value list, same shape as
 * `apps/api/src/modules/sales-settings/dto/create-master-list-item.dto.ts`. */
export class CreateMasterListItemDto {
  @ApiProperty({ enum: FINANCE_MASTER_LIST_CATEGORIES })
  @IsIn(FINANCE_MASTER_LIST_CATEGORIES)
  category!: FinanceMasterListCategory;

  @ApiProperty({ example: "Travel" })
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
