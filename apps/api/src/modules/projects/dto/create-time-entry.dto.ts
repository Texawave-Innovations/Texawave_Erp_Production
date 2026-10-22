import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateTimeEntryDto {
  @ApiProperty({ example: 120, description: "Duration in minutes" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiProperty({ example: "2026-08-14" })
  @IsDateString()
  entryDate!: string;

  @ApiPropertyOptional({ example: "Resolved sensor calibration jitter" })
  @IsOptional()
  @IsString()
  notes?: string;
}
