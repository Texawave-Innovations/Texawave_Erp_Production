import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QuerySalespersonDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Case-insensitive match on name or code",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
