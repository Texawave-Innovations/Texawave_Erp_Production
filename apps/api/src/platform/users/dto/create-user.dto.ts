import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { IsStrongPassword } from "../../../common/validation/password-policy.js";

export class CreateUserDto {
  @ApiProperty({ example: "user@texawave.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @Length(1, 100)
  fullName!: string;

  @ApiProperty({ example: "StrongP@ssw0rd!" })
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({
    description:
      "Force a password change on next login — set for an HR-issued temporary password",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  roleIds?: number[];

  @ApiPropertyOptional({ type: [Number], example: [1] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  teamIds?: number[];
}
