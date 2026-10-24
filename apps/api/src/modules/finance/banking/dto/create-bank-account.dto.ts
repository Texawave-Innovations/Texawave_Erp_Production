import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import {
  FINANCE_BANK_ACCOUNT_TYPES,
  type FinanceBankAccountType,
} from "../../finance.constants.js";

export class CreateBankAccountDto {
  @ApiProperty({ description: "Display name for the bank account" })
  @IsString()
  @MaxLength(100)
  accountName!: string;

  @ApiProperty({ description: "Bank account number (unique per organization)" })
  @IsString()
  @MaxLength(50)
  accountNumber!: string;

  @ApiProperty({ description: "Name of the banking institution" })
  @IsString()
  @MaxLength(100)
  bankName!: string;

  @ApiProperty({ description: "IFSC or branch routing code" })
  @IsString()
  @MaxLength(20)
  ifscCode!: string;

  @ApiPropertyOptional({ description: "Branch name or location" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchName?: string;

  @ApiPropertyOptional({
    enum: FINANCE_BANK_ACCOUNT_TYPES,
    default: "CURRENT",
  })
  @IsOptional()
  @IsIn(FINANCE_BANK_ACCOUNT_TYPES)
  accountType?: FinanceBankAccountType = "CURRENT";

  @ApiPropertyOptional({ default: "INR" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string = "INR";

  @ApiPropertyOptional({ description: "Opening balance", default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingBalance?: number = 0;

  @ApiPropertyOptional({
    description: "Linked Chart of Accounts Asset GL account ID",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  glAccountId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
