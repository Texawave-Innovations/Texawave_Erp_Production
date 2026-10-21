import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDateString, IsOptional, IsString, Length } from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";

export class QueryExchangeRatesDto extends PaginationDto {
  @ApiPropertyOptional({ example: "USD" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase().trim() : value,
  )
  @IsString()
  @Length(3, 3)
  fromCurrency?: string;

  @ApiPropertyOptional({ example: "INR" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase().trim() : value,
  )
  @IsString()
  @Length(3, 3)
  toCurrency?: string;

  @ApiPropertyOptional({ example: "2026-10-16" })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}
