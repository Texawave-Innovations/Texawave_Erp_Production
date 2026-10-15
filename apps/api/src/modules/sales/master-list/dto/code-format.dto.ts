import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Length, Matches, Max, Min } from "class-validator";
import { UpperTrim } from "../../../../common/dto/transforms.js";
import { DOCUMENT_PREFIX_PATTERN } from "../code-formats.rules.js";

/** Edit one code format. Affects only codes issued afterwards. */
export class UpdateCodeFormatDto {
  @ApiPropertyOptional({
    example: "TW/QUO",
    description:
      "Upper-case letters/digits starting with a letter. Document prefixes may hold `/` (TW/QUO, max 20); a customer prefix may not (CUS, max 10)",
  })
  @IsOptional()
  @UpperTrim()
  @Length(1, 20)
  @Matches(DOCUMENT_PREFIX_PATTERN, {
    message:
      "prefix must be letters or digits starting with a letter, optionally in /-separated parts (no dashes)",
  })
  prefix?: string;

  @ApiPropertyOptional({
    example: 3,
    description: "Minimum digits of the running number (1-8)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  padding?: number;
}
