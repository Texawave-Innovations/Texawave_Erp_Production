import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdatePointsConfigDto {
  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  low?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  medium?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  high?: number;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  urgent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customRules?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "Switch the time-based rule on: points come from the ETA and the timer minutes, not from priority.",
  })
  @IsOptional()
  @IsBoolean()
  timeBasedEnabled?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: "Points of a finished task",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  defaultTaskPoints?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "Bonus for finishing within the ETA",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  onTimeBonus?: number;

  @ApiPropertyOptional({
    example: 5,
    description: "Minutes over the ETA that cost nothing",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  graceMinutes?: number;
}
