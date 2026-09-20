import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsObject, IsOptional, IsString, Length } from "class-validator";

export const TAG_COLOR_TOKENS = [
  "brand",
  "gray",
  "success",
  "warning",
  "error",
] as const;
export type TagColorToken = (typeof TAG_COLOR_TOKENS)[number];

export class CreateTagDto {
  @ApiProperty({ example: "High priority" })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ enum: TAG_COLOR_TOKENS, default: "gray" })
  @IsOptional()
  @IsIn(TAG_COLOR_TOKENS)
  colorToken?: TagColorToken;

  @ApiPropertyOptional({
    description: "Arbitrary extra fields, not queried/filtered/joined",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
