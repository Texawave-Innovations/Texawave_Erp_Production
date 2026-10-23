import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { Trim } from "../../../common/dto/transforms.js";

export class UpsertAuthorizedSignatoryDto {
  @ApiPropertyOptional({ example: "Jane Doe" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: "Commercial Manager" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  designation?: string;

  @ApiPropertyOptional({
    description: "Arbitrary extra fields, not queried/filtered/joined",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
