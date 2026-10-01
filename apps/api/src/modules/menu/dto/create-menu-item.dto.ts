import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { IsValidPermissionCode } from "../../settings/roles/dto/attach-role-permissions.dto.js";

export class CreateMenuItemDto {
  @ApiProperty({ example: "admin-departments" })
  @IsString()
  @Length(1, 100)
  code!: string;

  @ApiProperty({ example: "Departments" })
  @IsString()
  @Length(1, 100)
  label!: string;

  @ApiPropertyOptional({ example: "/admin/departments" })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ example: "folder" })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiPropertyOptional({
    example: "departments.department.read",
    description:
      "Permission code required to see this item (null = accessible by all authenticated users)",
  })
  @IsOptional()
  @IsString()
  @IsValidPermissionCode()
  permission?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Arbitrary extra fields, not queried/filtered/joined",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
