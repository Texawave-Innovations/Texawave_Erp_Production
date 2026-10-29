import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  SCM_MASTER_LIST_CATEGORIES,
  type ScmMasterListCategory,
} from "../scm-master-list-items.constants.js";

export class QueryMasterListItemDto extends PaginationDto {
  @ApiProperty({
    enum: SCM_MASTER_LIST_CATEGORIES,
    description: "Which SCM Master card to list",
  })
  @IsIn(SCM_MASTER_LIST_CATEGORIES)
  category!: ScmMasterListCategory;
}
