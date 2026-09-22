import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsInt } from "class-validator";

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
}
