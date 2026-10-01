import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QueryAuditLogDto extends PaginationDto {
  @ApiPropertyOptional({ example: "employee" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  entityType?: string;

  @ApiPropertyOptional({ description: "Requires entityType" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entityId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  actorUserId?: number;

  @ApiPropertyOptional({ example: "status_change" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  action?: string;

  @ApiPropertyOptional({ description: "Inclusive lower bound (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: "Exclusive upper bound (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
