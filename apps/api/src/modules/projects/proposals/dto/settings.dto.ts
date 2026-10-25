import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UpdateProposalSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showHeader?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showFooter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showHeaderLogo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showHeaderCompanyName?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showHeaderDocTitle?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showFooterEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showFooterPhone?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showFooterWebsite?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showFooterAddress?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showFooterPageNumber?: boolean;

  @ApiPropertyOptional({ example: "PROP" })
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiPropertyOptional({ enum: ["YYYY", "YY", "NONE"] })
  @IsOptional()
  @IsIn(["YYYY", "YY", "NONE"])
  yearFormat?: "YYYY" | "YY" | "NONE";

  @ApiPropertyOptional({ minimum: 1, maximum: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  sequenceDigits?: number;
}
