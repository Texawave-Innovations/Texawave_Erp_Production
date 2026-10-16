import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  SALES_MASTER_LIST_CATEGORIES,
  type SalesMasterListCategory,
} from "../sales-settings.constants.js";

export class QueryMasterListItemDto extends PaginationDto {
  @ApiProperty({
    enum: SALES_MASTER_LIST_CATEGORIES,
    description: "Which Terms & Inventory card to list",
  })
  @IsIn(SALES_MASTER_LIST_CATEGORIES)
  category!: SalesMasterListCategory;
}
