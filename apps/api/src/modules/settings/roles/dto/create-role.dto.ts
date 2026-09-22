import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class CreateRoleDto {
  @ApiProperty({ example: "HR Manager" })
  @IsString()
  @Length(1, 100)
  name!: string;
}
