import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Trim } from "../../../common/dto/transforms.js";

export class UpdateProjectCodeMasterDto {
  @ApiPropertyOptional({ example: "TXW" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  companyPrefix?: string;

  @ApiPropertyOptional({ example: "PRJ" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  moduleIdentifier?: string;

  @ApiPropertyOptional({ example: "ME" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  defaultProjectCode?: string;

  @ApiPropertyOptional({ example: "26-27" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  financialYear?: string;

  @ApiPropertyOptional({
    description: "Digits the project sequence is zero-padded to",
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  sequenceDigits?: number;
}
