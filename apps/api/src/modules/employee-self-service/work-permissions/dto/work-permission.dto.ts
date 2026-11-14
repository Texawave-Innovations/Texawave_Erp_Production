import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";

export class CreateWorkPermissionDto {
  @ApiProperty({
    description: "Date the permission covers (YYYY-MM-DD)",
    example: "2026-11-13",
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    description: "Start time within the day (HH:mm), must be ≥ 10:00",
    example: "14:00",
  })
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "fromTime must be a valid time in HH:mm format",
  })
  fromTime!: string;

  @ApiProperty({
    description: "End time within the day (HH:mm), must be ≤ 19:00",
    example: "16:00",
  })
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "toTime must be a valid time in HH:mm format",
  })
  toTime!: string;

  @ApiProperty({
    description: "Reason for the permission request",
    example: "Doctor appointment",
  })
  @Trim()
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class QueryMyWorkPermissionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Filter by year (YYYY)", example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;
}
