import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QueryBankAccountDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Case-insensitive match on bank name" })
  @IsOptional()
  @IsString()
  search?: string;
}
