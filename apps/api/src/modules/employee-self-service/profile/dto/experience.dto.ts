import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";
import { OptionalText, RequiredText } from "./onboarding-rules.js";

export class ExperienceDto {
  @RequiredText()
  employer!: string;

  @RequiredText()
  designation!: string;

  @IsDateString(
    { strict: true },
    { message: "Enter a valid date (YYYY-MM-DD)." },
  )
  fromDate!: string;

  @ApiPropertyOptional({ description: "Leave out if still current" })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: "Enter a valid date (YYYY-MM-DD)." },
  )
  toDate?: string;

  @OptionalText(300)
  reasonForLeaving?: string;
}
