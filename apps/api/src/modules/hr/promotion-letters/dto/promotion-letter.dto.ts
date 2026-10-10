import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Min } from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import { ComponentAmount } from "../../revision-letters/dto/revision-letter.dto.js";

/**
 * Issuing a promotion letter. Same fields as a revision letter, except the
 * designation is an id from the designations master (`/master-data/designations`)
 * instead of free text. The employee's name, previous designation and the
 * document number are never accepted from the client.
 */
export class CreatePromotionLetterDto {
  @ApiProperty({
    description:
      "Existing employee the letter is issued to. Must be in the caller's scope",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @ApiProperty({
    description: "Active designation from the designations master",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId!: number;

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
    description: "Defaults to the 1st of next month",
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

/** Edits. The employee link, previous designation and document number are
 * immutable, so `employeeId` is omitted and an unknown field is a 400. */
export class UpdatePromotionLetterDto extends PartialType(
  OmitType(CreatePromotionLetterDto, ["employeeId"] as const),
) {}

export class QueryPromotionLetterDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Only letters issued to this employee" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}
