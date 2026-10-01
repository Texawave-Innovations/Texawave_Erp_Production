import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";

export class CreateHolidayDto {
  @ApiProperty({ example: "2026-10-02", description: "Immutable once created" })
  @IsDateOnly()
  holidayDate!: string;

  @ApiProperty({ example: "Gandhi Jayanti" })
  @Trim()
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional({ description: "Send an empty string to clear" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description:
      "Only this work location observes it. Omit for the whole organization. Immutable.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workLocationId?: number;
}

/** The date and the scope never change — deactivate a wrong entry and enter a
 * new one, so history stays trustworthy. */
export class UpdateHolidayDto extends PartialType(
  OmitType(CreateHolidayDto, ["holidayDate", "workLocationId"] as const),
) {}

export class QueryHolidayDto extends PaginationDto {
  @ApiPropertyOptional({ example: 2026, description: "Calendar year" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number;

  @ApiPropertyOptional({
    example: "2026-01-01",
    description: "On/after (inclusive)",
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    example: "2026-12-31",
    description: "On/before (inclusive)",
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({ description: "Holidays of exactly this location" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workLocationId?: number;

  @ApiPropertyOptional({
    description: "true = only organization-wide holidays",
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  organizationWide?: boolean;

  @ApiPropertyOptional({ description: "Omit for active and deactivated" })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isActive?: boolean;
}
