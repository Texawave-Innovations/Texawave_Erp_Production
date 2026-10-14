import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { IsStrongPassword } from "../../../common/validation/password-policy.js";

export class ChangePasswordDto {
  @ApiProperty({ description: "The password currently in use (temp or real)" })
  @IsString()
  currentPassword!: string;

  @IsStrongPassword()
  newPassword!: string;
}
