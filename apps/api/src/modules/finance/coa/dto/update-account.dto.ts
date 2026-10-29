import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: "1010" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 50)
  accountCode?: string;

  @ApiPropertyOptional({ example: "Cash on Hand (Main)" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 150)
  accountName?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      "Parent account ID, or null to convert to top-level root account",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentAccountId?: number | null;

  @ApiPropertyOptional({ example: "INR" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: "Updated description notes" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  description?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: "Whether the account is active for postings",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
