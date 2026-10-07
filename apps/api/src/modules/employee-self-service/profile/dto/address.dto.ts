import { ApiProperty } from "@nestjs/swagger";
import {
  PINCODE,
  OptionalText,
  Pattern,
  RequiredText,
} from "./onboarding-rules.js";

export class AddressDto {
  @RequiredText(200)
  addressLine!: string;

  @OptionalText()
  areaLocality?: string;

  @RequiredText()
  district!: string;

  @RequiredText()
  city!: string;

  @RequiredText()
  state!: string;

  @ApiProperty({ example: "560034" })
  @Pattern(PINCODE.regex, PINCODE.message)
  pincode!: string;
}
