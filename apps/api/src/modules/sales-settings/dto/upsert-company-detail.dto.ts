import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { Trim } from "../../../common/dto/transforms.js";
import { IsImageDataUri } from "../../../common/dto/validators.js";

export class UpsertCompanyDetailDto {
  @ApiProperty({ example: "Texawave" })
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  gstin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  pan?: string;

  @ApiPropertyOptional({
    description: "Base64 data URI (PNG or JPG, max 5 MB)",
  })
  @IsOptional()
  @IsString()
  @IsImageDataUri()
  logoDataUri?: string;

  @ApiPropertyOptional({
    description: "Arbitrary extra fields, not queried/filtered/joined",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
