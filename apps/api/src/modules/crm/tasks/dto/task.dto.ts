import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  RELATED_TYPES,
  type RelatedType,
} from "../../shared/related-entity.js";

export const CRM_TASK_PRIORITIES = ["High", "Medium", "Low"] as const;
/** Mirrors legacy `CrmTask.status` exactly — only two states, unlike HR's
 * `Task` (which also has cancelled/in-progress-adjacent approval states). */
export const CRM_TASK_STATUSES = ["Open", "Completed"] as const;
export type CrmTaskStatus = (typeof CRM_TASK_STATUSES)[number];

export class CreateCrmTaskDto {
  @IsIn(RELATED_TYPES)
  relatedType!: RelatedType;

  @IsInt()
  @Min(1)
  relatedId!: number;

  @Trim()
  @IsString()
  @Length(1, 300)
  title!: string;

  @IsDateString()
  dueDate!: string;

  @Trim()
  @IsString()
  @Length(1, 150)
  assignedTo!: string;

  @ApiPropertyOptional({ enum: CRM_TASK_PRIORITIES })
  @IsOptional()
  @IsIn(CRM_TASK_PRIORITIES)
  priority?: (typeof CRM_TASK_PRIORITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCrmTaskDto extends PartialType(
  OmitType(CreateCrmTaskDto, ["relatedType", "relatedId"] as const),
) {}

export class UpdateCrmTaskStatusDto {
  @IsIn(CRM_TASK_STATUSES)
  status!: CrmTaskStatus;
}

export class QueryCrmTaskDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(RELATED_TYPES)
  relatedType?: RelatedType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  relatedId?: number;

  @ApiPropertyOptional({ enum: CRM_TASK_STATUSES })
  @IsOptional()
  @IsIn(CRM_TASK_STATUSES)
  status?: CrmTaskStatus;
}
