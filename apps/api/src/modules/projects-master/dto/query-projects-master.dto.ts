import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QueryProjectsMasterDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Case-insensitive name/code search" })
  @IsOptional()
  @IsString()
  search?: string;
}
