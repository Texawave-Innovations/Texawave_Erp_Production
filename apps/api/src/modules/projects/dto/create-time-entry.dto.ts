import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreateTimeEntryDto {
  @ApiProperty({ example: 120, description: "Duration in minutes" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(960, { message: "A single entry cannot be longer than 16 hours" })
  durationMinutes!: number;

  @ApiProperty({ example: "2026-08-14" })
  @IsDateString()
  entryDate!: string;

  @ApiPropertyOptional({ example: "Resolved sensor calibration jitter" })
  @IsOptional()
  @IsString()
  notes?: string;
}
