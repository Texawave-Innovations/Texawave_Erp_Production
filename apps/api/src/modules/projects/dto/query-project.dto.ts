import { ApiPropertyOptional } from "@nestjs/swagger";
import { ProjectStatus } from "@texawave-erp/database";
import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString } from "class-validator";

export const PROJECT_HEALTH_FILTERS = [
  "on_track",
  "delayed",
  "completed",
  "upcoming",
] as const;
export type ProjectHealthFilter = (typeof PROJECT_HEALTH_FILTERS)[number];
import { PaginationDto } from "../../../common/dto/pagination.dto.js";

export class QueryProjectDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Case-insensitive code or name search" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: "Matches projects whose departments[] includes this value",
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    enum: PROJECT_HEALTH_FILTERS,
    description:
      "Computed health filter across ALL projects (not just one page); `upcoming` = an open milestone due within 7 days",
  })
  @IsOptional()
  @IsIn(PROJECT_HEALTH_FILTERS)
  health?: ProjectHealthFilter;

  @ApiPropertyOptional({ description: "Customer/Account ID filter" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}
