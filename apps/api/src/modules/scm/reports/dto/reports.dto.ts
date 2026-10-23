import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

/** Every report is a capped, unpaginated row list for display + CSV export
 * — reports are read-only snapshots, not a document list a user pages
 * through, so there is no `page`/`limit` contract to match here. */
export class ReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  to?: string;
}
