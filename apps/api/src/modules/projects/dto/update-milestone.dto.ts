import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { MilestoneStatus } from "@texawave-erp/database";
import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { CreateMilestoneDto } from "./create-milestone.dto.js";

export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {
  @ApiPropertyOptional({ enum: MilestoneStatus })
  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;

  @ApiPropertyOptional({ example: "2026-09-14" })
  @IsOptional()
  @IsDateString()
  actualDate?: string;
}
