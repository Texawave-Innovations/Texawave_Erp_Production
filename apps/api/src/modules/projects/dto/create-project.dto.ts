import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProjectStatus } from "@texawave-erp/database";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class CreateProjectDto {
  @ApiProperty({ example: "Leak Detection Automation System" })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({ example: "Automated test firmware and leak sensors" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional({ example: "Global Enterprises Pvt Ltd" })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ example: "Software" })
  @IsOptional()
  @IsString()
  projectType?: string;

  @ApiPropertyOptional({
    example: ["Software", "Electronics"],
    description:
      "Multi-department selection (legacy ProjectForm chip-toggle UX)",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];

  @ApiPropertyOptional({
    example: ["Priya Sharma", "Arun Kumar"],
    description:
      "Name-based resource assignment (legacy exact parity). Resolved to employeeIds via initialMemberEmployeeIds for FK integrity.",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resourceNames?: string[];

  @ApiPropertyOptional({ example: 480 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedHours?: number;

  @ApiPropertyOptional({ example: 60000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  projectPrice?: number;

  @ApiProperty({ example: "2026-08-01" })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: "2026-11-30" })
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @ApiPropertyOptional({ example: "2026-12-15" })
  @IsOptional()
  @IsDateString()
  actualEndDate?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.active })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  clientHandlingPersonId?: number;

  @ApiPropertyOptional({ example: [2, 3] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  initialMemberEmployeeIds?: number[];

  @ApiPropertyOptional({ description: "Arbitrary custom fields" })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
