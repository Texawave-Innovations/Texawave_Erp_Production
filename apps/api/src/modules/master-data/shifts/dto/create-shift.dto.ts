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

import { Type } from "class-transformer";
import { TIME_PATTERN } from "../shift-time.js";
export class CreateShiftDto {
  @ApiProperty({ example: "GENERAL", description: "Immutable once created" })
  @UpperTrim()
  @IsString()
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;

  @ApiProperty({ example: "General shift" })
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
  @ApiProperty({
    example: "09:00",
    description: "HH:MM, 24-hour. No time zone.",
  })
  @Trim()
  @Matches(TIME_PATTERN, { message: "startTime must be HH:MM (24-hour)" })
  startTime!: string;

  @ApiProperty({
    example: "18:00",
    description: "Earlier than startTime means the shift crosses midnight",
  })
  @Trim()
  @Matches(TIME_PATTERN, { message: "endTime must be HH:MM (24-hour)" })
  endTime!: string;

  @ApiProperty({
    example: 480,
    description: "Expected working minutes; at most the start–end window",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  workingMinutes!: number;
}
