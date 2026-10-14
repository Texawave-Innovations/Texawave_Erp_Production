import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { QueryBoolean } from "../../../../common/dto/transforms.js";

/** A 500-row CSV is far below this; anything larger is not an employee list. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export class ImportEmployeesQueryDto {
  @ApiPropertyOptional({
    description:
      "Validate every row (including database checks) but save nothing",
    default: false,
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  dryRun?: boolean;
}
