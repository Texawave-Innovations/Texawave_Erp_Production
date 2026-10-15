import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Matches, Max, Min } from "class-validator";
import { UpperTrim } from "../../../../common/dto/transforms.js";

/** Edit one code format. Affects only codes issued afterwards. */
export class UpdateCodeFormatDto {
  @ApiPropertyOptional({
    example: "CUS",
    description: "1-10 upper-case letters/digits, starting with a letter",
  })
  @IsOptional()
  @UpperTrim()
  @Matches(/^[A-Z][A-Z0-9]{0,9}$/, {
    message:
      "prefix must be 1-10 letters or digits, starting with a letter (no dashes)",
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
