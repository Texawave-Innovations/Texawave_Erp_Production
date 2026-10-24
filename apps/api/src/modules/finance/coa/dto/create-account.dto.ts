import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  FINANCE_ACCOUNT_TYPES,
  type FinanceAccountType,
} from "../../finance.constants.js";

export class CreateAccountDto {
  @ApiProperty({
    example: "1010",
    description: "Unique account code per organization",
  })
  @Trim()
  @IsString()
  @Length(1, 50)
  accountCode!: string;

  @ApiProperty({
    example: "Cash on Hand",
    description: "Descriptive name of the account",
  })
  @Trim()
  @IsString()
  @Length(1, 150)
  accountName!: string;

  @ApiProperty({
    enum: FINANCE_ACCOUNT_TYPES,
    example: "ASSET",
    description: "Account classification in Chart of Accounts",
  })
  @IsIn(FINANCE_ACCOUNT_TYPES)
  accountType!: FinanceAccountType;

  @ApiPropertyOptional({
    example: 1,
    description: "Parent account ID for hierarchical grouping",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentAccountId?: number;

  @ApiPropertyOptional({
    example: "INR",
    default: "INR",
    description: "Account currency",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    example: "Petty cash and cash in drawer",
    description: "Optional notes and description",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  description?: string;
}
