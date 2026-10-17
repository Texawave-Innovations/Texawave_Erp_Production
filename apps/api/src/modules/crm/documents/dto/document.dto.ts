import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  RELATED_TYPES,
  type RelatedType,
} from "../../shared/related-entity.js";

/** Legacy `CrmDocument` is name + external link only — no real file upload
 * (Firebase Storage was never wired up) and no update endpoint. Reproduced
 * the same way: create/delete/list only. */
export class CreateCrmDocumentDto {
  @IsIn(RELATED_TYPES)
  relatedType!: RelatedType;

  @IsInt()
  @Min(1)
  relatedId!: number;

  @Trim()
  @IsString()
  @Length(1, 300)
  name!: string;

  @Trim()
  @IsString()
  @Length(1, 1000)
  link!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryCrmDocumentDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(RELATED_TYPES)
  relatedType?: RelatedType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  relatedId?: number;

  @ApiPropertyOptional({
    description:
      "Account roll-up: records of this account AND of its contacts and opportunities",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  rollupAccountId?: number;
}
