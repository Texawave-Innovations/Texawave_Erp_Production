import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsObject, IsOptional, IsString, Length } from "class-validator";

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({ enum: ["light", "dark", "system"], nullable: true })
  @IsOptional()
  @IsIn(["light", "dark", "system", null])
  theme?: "light" | "dark" | "system" | null;

  @ApiPropertyOptional({
    enum: ["compact", "comfortable", "spacious"],
    nullable: true,
  })
  @IsOptional()
  @IsIn(["compact", "comfortable", "spacious", null])
  density?: "compact" | "comfortable" | "spacious" | null;

  @ApiPropertyOptional({ example: "en-IN", nullable: true })
  @IsOptional()
  @IsString()
  locale?: string | null;

  @ApiPropertyOptional({ example: "Asia/Kolkata", nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string | null;

  @ApiPropertyOptional({
    enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
    nullable: true,
  })
  @IsOptional()
  @IsIn(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", null])
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | null;

  @ApiPropertyOptional({ enum: ["12h", "24h"], nullable: true })
  @IsOptional()
  @IsIn(["12h", "24h", null])
  timeFormat?: "12h" | "24h" | null;

  @ApiPropertyOptional({ example: "INR", nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  displayCurrency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
