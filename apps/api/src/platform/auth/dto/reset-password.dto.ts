import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { IsStrongPassword } from "../../../common/validation/password-policy.js";

export class ResetPasswordDto {
  @ApiProperty({ description: "Raw reset token from the emailed link" })
  @IsString()
  token!: string;

  @IsStrongPassword()
  newPassword!: string;
}
