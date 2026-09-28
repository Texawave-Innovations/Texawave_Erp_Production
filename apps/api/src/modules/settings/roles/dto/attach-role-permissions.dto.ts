import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";

export const PERMISSION_CODE_REGEX =
  /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*\.[a-z]+(\.(own|team|all))?$/;

export function IsValidPermissionCode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isValidPermissionCode",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") return false;
          if (!PERMISSION_CODE_REGEX.test(value)) return false;
          const parts = value.split(".");
          const action = parts[2];
          if (action === "manage" || action === "read-write") return false;
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `Each permission code in ${args.property} must match "<module>.<entity>.<action>" or "<module>.<entity>.<action>.(own|team|all)" per CODING_STANDARDS.md §2a`;
        },
      },
    });
  };
}

export class AttachRolePermissionsDto {
  @ApiPropertyOptional({
    type: [String],
    example: ["departments.department.read", "settings.role.write"],
    description: "Permission codes complying with CODING_STANDARDS.md §2a",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsValidPermissionCode({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ["departments.department.read"],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsValidPermissionCode({ each: true })
  permissionCodes?: string[];

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  permissionIds?: number[];
}
