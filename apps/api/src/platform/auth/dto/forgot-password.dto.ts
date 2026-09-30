import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "demo" })
  @IsString()
  organizationSlug!: string;

  @ApiProperty({ example: "admin@demo.local" })
  @IsEmail()
  email!: string;
}
