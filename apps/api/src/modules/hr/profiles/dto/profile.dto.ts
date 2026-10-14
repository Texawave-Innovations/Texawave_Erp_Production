import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { Trim } from "../../../../common/dto/transforms.js";

/** A postal address. Stored as a JSON object on the profile row. */
export class AddressDto {
  @Trim()
  @IsString()
  @Length(1, 200)
  address!: string;

  @Trim()
  @IsOptional()
  @IsString()
  @Length(0, 100)
  area?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @Length(0, 100)
  district?: string;

  @Trim()
  @IsString()
  @Length(1, 100)
  city!: string;

  @Trim()
  @IsString()
  @Length(1, 100)
  state!: string;

  @Trim()
  @IsString()
  @Matches(/^[0-9A-Za-z -]{3,10}$/, {
    message: "pincode has an invalid format",
  })
  pincode!: string;

  @Trim()
  @IsOptional()
  @IsString()
  @Length(0, 100)
  country?: string;
}

const PHONE = /^[0-9+ ()-]{6,20}$/;

/**
 * Personal, non-sensitive profile fields (legacy EmployeeForm / EmployeeProfileView /
 * SelfOnboarding). Partial: an omitted field is unchanged; an explicit `null`
 * clears it. Name, contact, joining date and placement are NOT here: they live on
 * the employee record.
 */
export class UpdateEmployeeProfileDto {
  @ApiPropertyOptional({ example: "Mr" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 20)
  title?: string | null;

  @ApiPropertyOptional({ example: "1992-04-18" })
  @IsOptional()
  @IsDateOnly()
  dateOfBirth?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 30)
  gender?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 30)
  maritalStatus?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 10)
  bloodGroup?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Trim()
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  languages?: string[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  fatherName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  motherName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  spouseName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  emergencyContactName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Matches(PHONE, { message: "emergencyContactPhone has an invalid format" })
  emergencyContactPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 60)
  emergencyContactRelation?: string | null;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  presentAddress?: AddressDto | null;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  permanentAddress?: AddressDto | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFresher?: boolean | null;

  @ApiPropertyOptional({
    example: 4.5,
    description: "Years, one decimal place",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 1 })
  @Min(0)
  @Max(60)
  experienceYears?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  previousCompany?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  previousRole?: string | null;
}

/**
 * Sensitive identifiers and bank details. Formats are enforced here; the legacy
 * app had no format checks. Same partial/null semantics as the profile.
 */
export class UpdateEmployeeSensitiveDto {
  @ApiPropertyOptional({ example: "ABCDE1234F" })
  @IsOptional()
  @Trim()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: "panNumber must be 10 uppercase characters, e.g. ABCDE1234F",
  })
  panNumber?: string | null;

  @ApiPropertyOptional({ example: "123412341234" })
  @IsOptional()
  @Trim()
  @Matches(/^[0-9]{12}$/, { message: "aadhaarNumber must be 12 digits" })
  aadhaarNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @Matches(/^[0-9]{10,17}$/, { message: "esiNumber must be 10 to 17 digits" })
  esiNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(5, 30)
  pfNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 100)
  bankName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 100)
  bankBranch?: string | null;

  @ApiPropertyOptional({ example: "123456789012" })
  @IsOptional()
  @Trim()
  @Matches(/^[0-9]{6,20}$/, { message: "bankAccountNo must be 6 to 20 digits" })
  bankAccountNo?: string | null;

  @ApiPropertyOptional({ example: "SBIN0001234" })
  @IsOptional()
  @Trim()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: "bankIfsc must be a valid IFSC, e.g. SBIN0001234",
  })
  bankIfsc?: string | null;
}
