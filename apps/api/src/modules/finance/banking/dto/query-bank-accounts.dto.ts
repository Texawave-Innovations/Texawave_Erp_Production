import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  FINANCE_BANK_ACCOUNT_TYPES,
  type FinanceBankAccountType,
} from "../../finance.constants.js";

export class QueryBankAccountsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FINANCE_BANK_ACCOUNT_TYPES })
  @IsOptional()
  @IsIn(FINANCE_BANK_ACCOUNT_TYPES)
  accountType?: FinanceBankAccountType;

  @ApiPropertyOptional({ description: "Filter by active status" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Search by account name, bank name, or account number",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
