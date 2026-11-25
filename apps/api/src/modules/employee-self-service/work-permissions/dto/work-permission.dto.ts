import { FIELD_FORMAT } from "../../../../common/dto/field-formats.js";
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
  @Matches(FIELD_FORMAT.time, {
    message: "fromTime must be a valid time in HH:mm format",
  })
  fromTime!: string;

  @ApiProperty({
    description: "End time within the day (HH:mm), must be ≤ 19:00",
    example: "16:00",
  })
  @Matches(FIELD_FORMAT.time, {
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

export class QueryAllWorkPermissionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Filter by status", example: "PENDING" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "Filter by year (YYYY)", example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;
}

export class DecideWorkPermissionDto {
  @ApiProperty({ description: "APPROVED or REJECTED", example: "APPROVED" })
  @IsString()
  decision!: string;

  @ApiPropertyOptional({
    description: "Note for the employee (required when rejecting)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  hrNote?: string;
}
