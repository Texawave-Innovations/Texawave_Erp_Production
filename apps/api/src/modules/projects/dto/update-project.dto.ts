import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ProjectStatus } from "@texawave-erp/database";
import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { CreateProjectDto } from "./create-project.dto.js";

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.active })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: "2026-11-25" })
  @IsOptional()
  @IsDateString()
  actualEndDate?: string;
}
