import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, Length } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const RECYCLE_BIN_ENTITY_TYPES = [
  "account",
  "lead",
  "contact",
  "opportunity",
  "deal_product",
  "pipeline_stage",
  "product",
  "quotation",
  "meeting",
  "follow_up",
  "activity",
  "task",
  "document",
  "note",
  "cold_calling",
  "mining_row",
  "quota",
] as const;
export type RecycleBinEntityType = (typeof RECYCLE_BIN_ENTITY_TYPES)[number];

export class QueryRecycleBinDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RECYCLE_BIN_ENTITY_TYPES })
  @IsOptional()
  @IsIn(RECYCLE_BIN_ENTITY_TYPES as readonly string[])
  entityType?: RecycleBinEntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  search?: string;
}

/** Permanent delete is irreversible: the caller must send `confirm: true`. */
export class PurgeRecycleBinDto {
  @IsBoolean()
  confirm!: boolean;
}
