import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";

/**
 * Exactly one of `employeeId` / `teamId` must be given. That "exactly one"
 * rule is checked by the service (422 ASSIGNMENT_TARGET_INVALID) and by a
 * database CHECK; the DTO only validates each field's own shape.
 */
export class CreateShiftAssignmentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  shiftId!: number;

  @ApiPropertyOptional({
    description: "Assign this employee… (or teamId, not both)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional({
    description: "…or make this the default shift of a whole team",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiProperty({
    example: "2026-10-01",
    description: "First day it applies (inclusive)",
  })
  @IsDateOnly()
  effectiveFrom!: string;

  @ApiPropertyOptional({
    example: "2026-12-31",
    description: "Last day (inclusive); omit for open-ended",
  })
  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  reason?: string;
}

export class EndShiftAssignmentDto {
  @ApiProperty({
    example: "2026-12-31",
    description: "The last day the assignment applies (inclusive)",
  })
  @IsDateOnly()
  effectiveTo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 500)
  reason?: string;
}

export class VoidShiftAssignmentDto {
  @ApiProperty({
    description: "Why the assignment was entered in error — mandatory",
  })
  @Trim()
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class QueryShiftAssignmentDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  shiftId?: number;

  @ApiPropertyOptional({
    example: "2026-10-15",
    description: "Only assignments covering this day",
  })
  @IsOptional()
  @IsDateOnly()
  activeOn?: string;

  @ApiPropertyOptional({
    description: "Include voided (entered-in-error) assignments; default false",
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  includeVoided?: boolean;
}

export class ResolveShiftQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @ApiProperty({ example: "2026-10-15" })
  @IsDateOnly()
  date!: string;
}
