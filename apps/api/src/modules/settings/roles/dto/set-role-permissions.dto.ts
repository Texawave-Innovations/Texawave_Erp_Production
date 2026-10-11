import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsInt, IsOptional, Min } from "class-validator";

/** The full set of permission ids this role should hold after the call —
 * a replace, not a patch. Ids not in the current catalog are silently
 * ignored (defensive against a stale client submitting against an old
 * catalog snapshot), not rejected. */
export class SetRolePermissionsDto {
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  permissionIds!: number[];

  @ApiPropertyOptional({
    description:
      "The role's version as read. When given, the change is refused with 409 VERSION_CONFLICT if someone else changed the role since.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
