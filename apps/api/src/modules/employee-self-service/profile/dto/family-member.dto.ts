import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";
import { MOBILE, Pattern, RequiredText } from "./onboarding-rules.js";

export class FamilyMemberDto {
  @RequiredText()
  name!: string;

  @RequiredText(50)
  relation!: string;

  @ApiPropertyOptional({ example: "1968-07-02" })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: "Enter a valid date (YYYY-MM-DD)." },
  )
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Pattern(MOBILE.regex, MOBILE.message)
  contactPhone?: string;
}
