import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  FINANCE_MASTER_LIST_CATEGORIES,
  type FinanceMasterListCategory,
} from "../finance-settings.constants.js";

export class QueryMasterListItemDto extends PaginationDto {
  @ApiProperty({
    enum: FINANCE_MASTER_LIST_CATEGORIES,
    description: "Which Finance Master card to list",
  })
  @IsIn(FINANCE_MASTER_LIST_CATEGORIES)
  category!: FinanceMasterListCategory;
}
