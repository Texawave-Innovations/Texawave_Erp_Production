import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional } from "class-validator";
import {
  BLOOD_GROUPS,
  GENDERS,
  MARITAL_STATUSES,
  MOBILE,
  Pattern,
  RequiredName,
  RequiredText,
} from "./onboarding-rules.js";

export class PersonalDetailsDto {
  @ApiProperty({ example: "1998-04-12" })
  @IsDateString(
    { strict: true },
    { message: "Enter a valid date (YYYY-MM-DD)." },
  )
  dateOfBirth!: string;

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS, { message: "Select a valid gender." })
  gender!: (typeof GENDERS)[number];

  @ApiPropertyOptional({ enum: MARITAL_STATUSES })
  @IsOptional()
  @IsIn(MARITAL_STATUSES, { message: "Select a valid marital status." })
  maritalStatus?: (typeof MARITAL_STATUSES)[number];

  @ApiPropertyOptional({ enum: BLOOD_GROUPS })
  @IsOptional()
  @IsIn(BLOOD_GROUPS, { message: "Select a valid blood group." })
  bloodGroup?: (typeof BLOOD_GROUPS)[number];

  @RequiredName()
  emergencyContactName!: string;

  @RequiredName()
  emergencyContactRelation!: string;

  @RequiredText(15)
  @Pattern(MOBILE.regex, MOBILE.message)
  emergencyContactPhone!: string;

  @RequiredName()
  fatherName!: string;

  @RequiredText(15)
  @Pattern(MOBILE.regex, MOBILE.message)
  fatherPhone!: string;

  @RequiredName()
  motherName!: string;

  @RequiredText(15)
  @Pattern(MOBILE.regex, MOBILE.message)
  motherPhone!: string;
}
