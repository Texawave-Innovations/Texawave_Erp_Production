import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class CreateMilestoneDto {
  @ApiProperty({ example: "Phase 1: Architecture & Design" })
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiProperty({ example: "2026-09-15" })
  @IsDateString()
  targetDate!: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;
}
