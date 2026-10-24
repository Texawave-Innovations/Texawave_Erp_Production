import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  FINANCE_BANK_ACCOUNT_TYPES,
  type FinanceBankAccountType,
} from "../../finance.constants.js";

export class UpdateBankAccountDto {
  @ApiPropertyOptional({ description: "Display name for the bank account" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountName?: string;

  @ApiPropertyOptional({ description: "Name of the banking institution" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({ description: "IFSC or branch routing code" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ifscCode?: string;

  @ApiPropertyOptional({ description: "Branch name or location" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchName?: string;

  @ApiPropertyOptional({ enum: FINANCE_BANK_ACCOUNT_TYPES })
  @IsOptional()
  @IsIn(FINANCE_BANK_ACCOUNT_TYPES)
  accountType?: FinanceBankAccountType;

  @ApiPropertyOptional({
    description: "Linked Chart of Accounts Asset GL account ID",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  glAccountId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
