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

/** Shape shared by both masterlists. `kind` is set by the controller, not the
 * caller — see `company-seals.controller.ts` / `authorized-signatures.controller.ts`. */
export class CreateSealSignatureDto {
  @ApiProperty({ example: "Official Round Seal" })
  @Trim()
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiPropertyOptional({
    description: "Only meaningful for the Authorized Signature masterlist",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  signatoryName?: string;

  @ApiPropertyOptional({
    description: "Only meaningful for the Authorized Signature masterlist",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  designation?: string;

  @ApiProperty({ description: "Base64 data URI (PNG or JPG, max 5 MB)" })
  @IsString()
  @IsImageDataUri()
  imageDataUri!: string;

  @ApiPropertyOptional({
    description: "Arbitrary extra fields, not queried/filtered/joined",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
