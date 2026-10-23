import { ApiPropertyOptional } from "@nestjs/swagger";
import { ProjectStatus } from "@texawave-erp/database";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
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

  @ApiPropertyOptional({ description: "Department filter" })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: "Customer/Account ID filter" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}
