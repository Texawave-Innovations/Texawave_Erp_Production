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

export const LEAVE_TYPE_SORT_FIELDS = ["name", "code", "createdAt"] as const;

export class QueryLeaveTypeDto extends PaginationDto {
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

  @ApiPropertyOptional({ enum: LEAVE_TYPE_SORT_FIELDS, default: "name" })
  @IsOptional()
  @IsIn(LEAVE_TYPE_SORT_FIELDS)
  sortBy?: (typeof LEAVE_TYPE_SORT_FIELDS)[number];
}
