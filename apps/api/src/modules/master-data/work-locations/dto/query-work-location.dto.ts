import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";

export const WORK_LOCATION_SORT_FIELDS = ["name", "code", "createdAt"] as const;

export class QueryWorkLocationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Case-insensitive match on code or name",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: "Omit to list active and inactive" })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: WORK_LOCATION_SORT_FIELDS, default: "name" })
  @IsOptional()
  @IsIn(WORK_LOCATION_SORT_FIELDS)
  sortBy?: (typeof WORK_LOCATION_SORT_FIELDS)[number];
}
