import { applyDecorators } from "@nestjs/common";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";
import { AddressDto } from "./address.dto.js";
import {
  BLOOD_GROUPS,
  GENDERS,
  MARITAL_STATUSES,
  MOBILE,
  NAME,
} from "./onboarding-rules.js";

/** Absent means "leave unchanged"; when present the value must be valid —
 * `null` is NOT accepted (these are required once onboarding is done, so an
 * employee cannot blank them out). Unlike @IsOptional(), which also skips null. */
const Present = () => ValidateIf((_o, value) => value !== undefined);

function SelfName() {
  return applyDecorators(
    ApiPropertyOptional(),
    Present(),
    IsString({ message: "Must be text." }),
    MinLength(1, { message: "This field is required." }),
    MaxLength(100, { message: "Must be at most 100 characters." }),
    Matches(NAME.regex, { message: NAME.message }),
  );
}

function SelfMobile() {
  return applyDecorators(
    ApiPropertyOptional({ example: "9876543210" }),
    Present(),
    IsString({ message: "Must be text." }),
    Matches(MOBILE.regex, { message: MOBILE.message }),
  );
}

/**
 * What an employee may change on their OWN record after onboarding
 * (PATCH employee/profile). Mirrors the legacy portal's "Edit Profile"
 * (TexaWave_ERP_old src/modules/employee/MyProfile.tsx): full name, personal
 * details and contact details. Partial — only the keys sent are changed.
 *
 * Deliberately absent (the global ValidationPipe's forbidNonWhitelisted turns
 * any of them into a 400): work e-mail (the login identity), department,
 * designation, team, reporting line, employment type, work location, date of
 * joining, salary, bank details and government IDs. Those stay with HR
 * (hr/employees, hr/profiles, hr/.../sensitive) — legacy also showed bank
 * details read-only to the employee.
 */
export class SelfProfileUpdateDto {
  // Identity (hr.employees, mirrored to the login's display name) — legacy
  // let the employee edit their name; the work e-mail stays HR-only.
  @ApiPropertyOptional({ example: "Asha Verma" })
  @Present()
  @Trim()
  @IsString({ message: "Must be text." })
  @MinLength(1, { message: "This field is required." })
  @MaxLength(200, { message: "Must be at most 200 characters." })
  @Matches(NAME.regex, { message: NAME.message })
  fullName?: string;

  // Contact (hr.employees)
  @SelfMobile()
  phone?: string;

  @ApiPropertyOptional({ nullable: true, description: "null clears it" })
  @IsOptional()
  @IsString({ message: "Must be text." })
  @MaxLength(100, { message: "Must be at most 100 characters." })
  referredBy?: string | null;

  // Personal (hr.employee_personal_details)
  @ApiPropertyOptional({ example: "1998-04-12" })
  @Present()
  @IsDateString(
    { strict: true },
    { message: "Enter a valid date (YYYY-MM-DD)." },
  )
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @Present()
  @IsIn(GENDERS, { message: "Select a valid gender." })
  gender?: (typeof GENDERS)[number];

  @ApiPropertyOptional({ enum: MARITAL_STATUSES, nullable: true })
  @IsOptional()
  @IsIn(MARITAL_STATUSES, { message: "Select a valid marital status." })
  maritalStatus?: (typeof MARITAL_STATUSES)[number] | null;

  @ApiPropertyOptional({ enum: BLOOD_GROUPS, nullable: true })
  @IsOptional()
  @IsIn(BLOOD_GROUPS, { message: "Select a valid blood group." })
  bloodGroup?: (typeof BLOOD_GROUPS)[number] | null;

  @SelfName()
  emergencyContactName?: string;

  @SelfName()
  emergencyContactRelation?: string;

  @SelfMobile()
  emergencyContactPhone?: string;

  @SelfName()
  fatherName?: string;

  @SelfMobile()
  fatherPhone?: string;

  @SelfName()
  motherName?: string;

  @SelfMobile()
  motherPhone?: string;

  // Addresses (hr.employee_addresses)
  @ApiPropertyOptional({ type: AddressDto })
  @Present()
  @ValidateNested()
  @Type(() => AddressDto)
  permanentAddress?: AddressDto;

  @ApiPropertyOptional({
    type: AddressDto,
    nullable: true,
    description: "null = same as permanent (removes the present address)",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  presentAddress?: AddressDto | null;
}
