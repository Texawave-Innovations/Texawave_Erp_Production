import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class UpdateOrganizationSettingsDto {
  @ApiPropertyOptional({ enum: ["light", "dark", "system"] })
  @IsOptional()
  @IsIn(["light", "dark", "system"])
  theme?: "light" | "dark" | "system";

  @ApiPropertyOptional({ enum: ["compact", "comfortable", "spacious"] })
  @IsOptional()
  @IsIn(["compact", "comfortable", "spacious"])
  density?: "compact" | "comfortable" | "spacious";

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ example: "en-IN" })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: "Asia/Kolkata" })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] })
  @IsOptional()
  @IsIn(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"])
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

  @ApiPropertyOptional({ enum: ["12h", "24h"] })
  @IsOptional()
  @IsIn(["12h", "24h"])
  timeFormat?: "12h" | "24h";

  @ApiPropertyOptional({ example: "INR" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;

  @ApiPropertyOptional({ example: "USD" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  displayCurrency?: string;

  @ApiPropertyOptional({ enum: ["before", "after"] })
  @IsOptional()
  @IsIn(["before", "after"])
  currencySymbolPosition?: "before" | "after";

  @ApiPropertyOptional({ enum: ["indian", "international"] })
  @IsOptional()
  @IsIn(["indian", "international"])
  numberFormat?: "indian" | "international";

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
