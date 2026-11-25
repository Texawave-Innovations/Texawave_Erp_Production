import { ApiProperty } from "@nestjs/swagger";
import {
  PINCODE,
  Pattern,
  RequiredName,
  RequiredText,
} from "./onboarding-rules.js";

export class AddressDto {
  @RequiredText(200)
  addressLine!: string;

  @RequiredName()
  areaLocality!: string;

  @RequiredName()
  district!: string;

  @RequiredName()
  city!: string;

  @RequiredName()
  state!: string;

  @ApiProperty({ example: "560034" })
  @Pattern(PINCODE.regex, PINCODE.message)
  pincode!: string;
}
