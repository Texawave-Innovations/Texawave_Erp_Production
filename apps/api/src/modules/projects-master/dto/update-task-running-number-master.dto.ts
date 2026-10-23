import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Trim } from "../../../common/dto/transforms.js";

export class UpdateTaskRunningNumberMasterDto {
  @ApiPropertyOptional({ example: "T" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 10)
  taskPrefix?: string;

  @ApiPropertyOptional({ example: "-" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 5)
  separator?: string;

  @ApiPropertyOptional({
    description: "Digits the task sequence is zero-padded to",
    default: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  sequenceDigits?: number;
}
