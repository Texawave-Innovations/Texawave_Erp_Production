import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { Trim } from "../../../../common/dto/transforms.js";
import { LowerTrim } from "./employee-transforms.js";

export const PHONE_PATTERN = /^[0-9+()\-\s]{6,20}$/;

/**
 * Deliberately has NO `status`, `employeeCode`, `dateOfExit`, `version` or
 * password/credential field: the code is generated, a new employee is always
 * ACTIVE (status changes go through the lifecycle endpoints), and a login is a
 * separate `users` row linked by `userId` — never stored here.
 */
export class CreateEmployeeDto {
  @ApiProperty({ example: "Asha Verma" })
  @Trim()
  @IsString()
  @Length(1, 200)
  fullName!: string;

  @ApiPropertyOptional({ example: "asha.verma@texawave.com" })
  @IsOptional()
  @LowerTrim()
  @IsEmail()
  @MaxLength(254)
  workEmail?: string;

  @ApiPropertyOptional({ example: "+91 98765 43210" })
  @IsOptional()
  @Trim()
  @Matches(PHONE_PATTERN, {
    message: "phone must be 6-20 digits/+()- characters",
  })
  phone?: string;

  @ApiProperty({ description: "Access boundary for team-scoped permissions" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId!: number;

  @ApiPropertyOptional({ description: "Defaults to the team's department" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employmentTypeId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workLocationId?: number;

  @ApiPropertyOptional({
    description: "Must be an ACTIVE employee of this organization",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reportsToId?: number;

  @ApiProperty({
    example: "2026-10-01",
    description: "Calendar date, YYYY-MM-DD",
  })
  @IsDateOnly()
  dateOfJoining!: string;

  @ApiPropertyOptional({
    description:
      "Link an existing platform user account (same organization, active, not linked to another employee)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}
