import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Trim } from "../../../common/dto/transforms.js";

export class UpdateDocumentNumberingDto {
  @ApiProperty({ example: "SQFY" })
  @Trim()
  @IsString()
  @Length(0, 20)
  prefix!: string;

  @ApiPropertyOptional({
    description: "Digits the running number is zero-padded to",
    default: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  padding?: number;
}
