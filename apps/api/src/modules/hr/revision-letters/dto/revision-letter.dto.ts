import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { applyDecorators } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

/** Largest value a `DECIMAL(12,2)` column holds. */
const MAX_COMPONENT = 9_999_999_999.99;

/** Money field: a rupee amount with at most 2 dp, never negative. */
export function ComponentAmount() {
  return applyDecorators(
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }),
    Min(0),
    Max(MAX_COMPONENT),
  );
}

/**
 * Issuing a revision letter. `employeeId` is required: legacy is only reachable
 * per employee (`revision-letter/:id`). The employee's name and document number
 * are never accepted from the client — the name comes from the employee record
 * and the number is issued by the server.
 */
export class CreateRevisionLetterDto {
  @ApiProperty({
    description:
      "Existing employee the letter is issued to. Must be in the caller's scope",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @ApiProperty({ example: "Senior Software Engineer" })
  @Trim()
  @IsString()
  @Length(2, 120)
  designation!: string;

  @ApiPropertyOptional({ example: "Chennai", default: "Chennai" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 120)
  location?: string;

  @ApiPropertyOptional({
    example: "2026-10-05",
    description: "Defaults to today (UTC)",
  })
  @IsOptional()
  @IsDateOnly()
  letterDate?: string;

  @ApiPropertyOptional({
    example: "2026-11-01",
    description: "Defaults to the 1st of next month (legacy default)",
  })
  @IsOptional()
  @IsDateOnly()
  effectiveDate?: string;

  @ApiPropertyOptional({ example: 35000, default: 0 })
  @IsOptional()
  @ComponentAmount()
  basic?: number;

  @ApiPropertyOptional({ example: 15000, default: 0 })
  @IsOptional()
  @ComponentAmount()
  da?: number;

  @ApiPropertyOptional({ example: 30000, default: 0 })
  @IsOptional()
  @ComponentAmount()
  hra?: number;

  @ApiPropertyOptional({ example: 20000, default: 0 })
  @IsOptional()
  @ComponentAmount()
  ca?: number;

  @ApiPropertyOptional({ example: "Amanullah Khan", default: "Amanullah Khan" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 120)
  signatoryName?: string;

  @ApiPropertyOptional({ example: "Co-Founder", default: "Co-Founder" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 120)
  signatoryDesignation?: string;
}

/** Edits. The employee link and the document number are immutable, so
 * `employeeId` is omitted here and an unknown field is rejected (400). */
export class UpdateRevisionLetterDto extends PartialType(
  OmitType(CreateRevisionLetterDto, ["employeeId"] as const),
) {}

export class QueryRevisionLetterDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Only letters issued to this employee" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}
