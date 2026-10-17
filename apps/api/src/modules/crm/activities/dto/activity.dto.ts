import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
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
  ACTIVITY_DIRECTIONS,
  ACTIVITY_TYPES,
} from "../../shared/activity-types.js";
import {
  RELATED_TYPES,
  type RelatedType,
} from "../../shared/related-entity.js";

export { ACTIVITY_TYPES, ACTIVITY_DIRECTIONS };

export class CreateActivityDto {
  @IsIn(RELATED_TYPES)
  relatedType!: RelatedType;

  @IsInt()
  @Min(1)
  relatedId!: number;

  @IsIn(ACTIVITY_TYPES)
  type!: (typeof ACTIVITY_TYPES)[number];

  @Trim()
  @IsString()
  @Length(1, 300)
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ACTIVITY_DIRECTIONS })
  @IsOptional()
  @IsIn(ACTIVITY_DIRECTIONS)
  direction?: (typeof ACTIVITY_DIRECTIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}

export class QueryActivityDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(RELATED_TYPES)
  relatedType?: RelatedType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  relatedId?: number;

  @ApiPropertyOptional({ enum: ACTIVITY_TYPES })
  @IsOptional()
  @IsIn(ACTIVITY_TYPES)
  type?: (typeof ACTIVITY_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  search?: string;

  /** Account plus its contacts (unified Account timeline). */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  accountId?: number;
}
