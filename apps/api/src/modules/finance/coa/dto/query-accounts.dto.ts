import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  FINANCE_ACCOUNT_TYPES,
  type FinanceAccountType,
} from "../../finance.constants.js";

export class QueryAccountsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: FINANCE_ACCOUNT_TYPES,
    description: "Filter accounts by classification",
  })
  @IsOptional()
  @IsIn(FINANCE_ACCOUNT_TYPES)
  accountType?: FinanceAccountType;

  @ApiPropertyOptional({ description: "Filter active or inactive accounts" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Search by account code or account name",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
