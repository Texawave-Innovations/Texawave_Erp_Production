import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Case-insensitive name or email search" })
  @IsOptional()
  @IsString()
  search?: string;
}
