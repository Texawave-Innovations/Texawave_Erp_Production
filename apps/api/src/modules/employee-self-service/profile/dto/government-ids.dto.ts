import { AADHAAR, ESI, PAN, PF, Pattern } from "./onboarding-rules.js";
import { IsOptional, Matches } from "class-validator";

export class GovernmentIdsDto {
  @Pattern(AADHAAR.regex, AADHAAR.message)
  aadhaarNumber!: string;

  @Pattern(PAN.regex, PAN.message)
  panNumber!: string;

  @IsOptional()
  @Matches(ESI.regex, { message: ESI.message })
  esiNumber?: string;

  @IsOptional()
  @Matches(PF.regex, { message: PF.message })
  pfNumber?: string;
}
