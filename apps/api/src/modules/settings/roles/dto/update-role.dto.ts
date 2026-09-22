import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

// Not `PartialType(CreateRoleDto)` — `isActive` isn't a create-time field
// (every role is created active; §5.1's `is_active` toggle is edited here,
// not at creation).
export class UpdateRoleDto {
  @ApiPropertyOptional({ example: "HR Manager" })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    description: "Disable the role without deleting it or its grant history",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
