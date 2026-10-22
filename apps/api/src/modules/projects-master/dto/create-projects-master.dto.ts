import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Length } from "class-validator";
import { Trim } from "../../../common/dto/transforms.js";

export class CreateProjectsMasterDto {
  @ApiProperty({ example: "ME" })
  @Trim()
  @IsString()
  @Length(1, 20)
  code!: string;

  @ApiProperty({ example: "Mechanical Engineering" })
  @Trim()
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional({ example: "Hardware CAD & Thermal" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  description?: string;
}
