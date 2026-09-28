import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QueryDepartmentDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Case-insensitive name search" })
  @IsOptional()
  @IsString()
  search?: string;
}
