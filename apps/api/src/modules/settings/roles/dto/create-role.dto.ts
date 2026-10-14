import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class CreateRoleDto {
  @ApiProperty({ example: "HR Manager" })
  @IsString()
  @Trim()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ example: "Runs HR across all teams" })
  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** A copy of a role's ACTIVE grants under a new name. The copy is never a
 * system role. */
export class CloneRoleDto {
  @ApiProperty({ example: "Payroll Officer" })
  @IsString()
  @Trim()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(500)
  description?: string;
}
