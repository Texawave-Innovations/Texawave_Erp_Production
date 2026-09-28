import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsInt } from "class-validator";

export class AssignUserRolesDto {
  @ApiProperty({
    type: [Number],
    example: [1, 2],
    description: "Role IDs within the caller's organization",
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  roleIds!: number[];
}
