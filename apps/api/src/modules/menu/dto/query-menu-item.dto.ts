import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QueryMenuItemDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Case-insensitive label or code search" })
  @IsOptional()
  @IsString()
  search?: string;
}
