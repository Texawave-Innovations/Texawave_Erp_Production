import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

// Not `PartialType(CreateRoleDto)` — `isActive` isn't a create-time field
// (every role is created active; §5.1's `is_active` toggle is edited here,
// not at creation).
export class UpdateRoleDto {
  @ApiPropertyOptional({ example: "HR Manager" })
  @IsOptional()
  @IsString()
  @Trim()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ nullable: true, description: "null clears it" })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Trim()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description: "Disable the role without deleting it or its grant history",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      "The role's version as read. When given, the change is refused with 409 VERSION_CONFLICT if someone else changed the role since.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
