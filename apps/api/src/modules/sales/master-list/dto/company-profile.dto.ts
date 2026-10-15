import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";
import { GSTIN_PATTERN, PAN_PATTERN } from "../../shared/gst.js";

/** The seller's details printed on every Sales document (whole record). */
export class UpsertCompanyProfileDto {
  @ApiProperty({ example: "Texawave Innovations Private Limited" })
  @Trim()
  @IsString()
  @Length(1, 200)
  legalName!: string;

  @ApiPropertyOptional({ example: "Advanced ERP & Engineering Solutions" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  tagline?: string | null;

  @ApiProperty({
    example:
      "No 93/206 Canal Bank Road, Indra Nagar, Adyar, Chennai - 600 020, Tamil Nadu, India",
  })
  @Trim()
  @IsString()
  @Length(1, 1000)
  address!: string;

  @ApiPropertyOptional({ example: "33AAMCT4293K1ZU" })
  @IsOptional()
  @UpperTrim()
  @Matches(GSTIN_PATTERN, {
    message: "gstin must be a valid 15-character GSTIN",
  })
  gstin?: string | null;

  @ApiPropertyOptional({
    example: "33",
    description:
      "Supplier GST state. Defaults to the GSTIN's state; required without a GSTIN",
  })
  @IsOptional()
  @Matches(/^[0-9]{2}$/, {
    message: "stateCode must be a two-digit GST state code",
  })
  stateCode?: string | null;

  @ApiPropertyOptional({ example: "AAMCT4293K" })
  @IsOptional()
  @UpperTrim()
  @Matches(PAN_PATTERN, { message: "pan must be a valid PAN" })
  pan?: string | null;

  @ApiPropertyOptional({ example: "sales@texawave.com" })
  @IsOptional()
  @Trim()
  @IsEmail()
  @Length(1, 254)
  email?: string | null;

  @ApiPropertyOptional({ example: "+91 44 1234 5678" })
  @IsOptional()
  @Trim()
  @Matches(/^[0-9+()\- ]{6,30}$/, { message: "phone must be a phone number" })
  phone?: string | null;
}
