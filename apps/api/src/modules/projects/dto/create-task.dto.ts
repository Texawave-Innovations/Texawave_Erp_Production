import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TaskPriority, TaskStatus } from "@texawave-erp/database";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateTaskDto {
  @ApiProperty({ example: "Firmware sensor polling loop" })
  @IsString()
  @Length(2, 255)
  title!: string;

  @ApiPropertyOptional({ example: "Implement timer-based ADC polling" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  milestoneId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedToId?: number;

  @ApiPropertyOptional({ example: "Software" })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ example: "2026-08-05" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2026-08-20" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.medium })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  dependencyTaskId?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  points?: number;

  @ApiPropertyOptional({
    example: 80,
    description: "Override automatic business hours",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hoursToComplete?: number;

  @ApiPropertyOptional({ description: "Arbitrary custom fields" })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: "Updated task title" })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  milestoneId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedToId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualEndDate?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ example: 65, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  completionPercent?: number;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  dependencyTaskId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hoursToComplete?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
