import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  IsInt,
  Max,
  Min,
} from "class-validator";
import {
  CODE_MESSAGE,
  CODE_PATTERN,
  Trim,
  UpperTrim,
} from "../../../../common/dto/transforms.js";

export class CreateEmploymentTypeDto {
  @ApiProperty({ example: "PERMANENT", description: "Immutable once created" })
  @UpperTrim()
  @IsString()
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;

  @ApiProperty({ example: "Permanent" })
  @Trim()
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ description: "Send an empty string to clear" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;
  @ApiPropertyOptional({
    description:
      "Stored only — no rule reads it yet (open business decision). null clears.",
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  probationDays?: number | null;

  @ApiPropertyOptional({
    description:
      "Stored only — no rule reads it yet (open business decision). null clears.",
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  noticeDays?: number | null;
}
