import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
import {
  CODE_MESSAGE,
  CODE_PATTERN,
  Trim,
  UpperTrim,
} from "../../../../common/dto/transforms.js";

export class CreateWorkLocationDto {
  @ApiProperty({ example: "HQ", description: "Immutable once created" })
  @UpperTrim()
  @IsString()
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;

  @ApiProperty({ example: "Head office" })
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
}
