import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { QueryBoolean } from "../../../common/dto/transforms.js";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QueryNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  unreadOnly?: boolean;
}
