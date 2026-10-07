import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Length } from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import { ComponentAmount } from "../../revision-letters/dto/revision-letter.dto.js";

/**
 * Generating an offer. Legacy requires candidate, role, location and joining
 * date; the rest are prefilled. The backend fills the prefills when omitted
 * (offer-letters.rules.ts). Status is never accepted from the client:
 * GENERATED is the only reachable status.
 */
export class CreateOfferLetterDto {
  @ApiProperty({
    example: "Arun Kumar R",
    description: "Free text, as legacy stores it",
  })
  @Trim()
  @IsString()
  @Length(2, 120)
  candidateName!: string;

  @ApiProperty({ example: "Senior Software Engineer" })
  @Trim()
  @IsString()
  @Length(2, 120)
  role!: string;

  @ApiPropertyOptional({ example: "Chennai" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 120)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 120)
  reportingManager?: string;

  @ApiPropertyOptional({
    example: "2026-10-05",
    description: "Defaults to today (UTC)",
  })
  @IsOptional()
  @IsDateOnly()
  offerDate?: string;

  @ApiProperty({ example: "2026-11-01" })
  @IsDateOnly()
  joiningDate!: string;

  @ApiPropertyOptional({
    example: "2026-10-12",
    description: "Defaults to the offer date plus 7 days (legacy)",
  })
  @IsOptional()
  @IsDateOnly()
  offerValidityDate?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 60)
  workScheduleMonFri?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 60)
  workScheduleSat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 60)
  workScheduleSun?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 120)
  signatoryName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 120)
  signatoryDesignation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsEmail()
  @Length(5, 120)
  companyEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(5, 30)
  companyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 120)
  companyWebsite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(5, 300)
  companyAddress?: string;
}

/** Edits overwrite the stored terms, as legacy does. Status cannot change. */
export class UpdateOfferLetterDto extends PartialType(CreateOfferLetterDto) {}

export class QueryOfferLetterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Case-insensitive match on candidate or role",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  search?: string;
}
