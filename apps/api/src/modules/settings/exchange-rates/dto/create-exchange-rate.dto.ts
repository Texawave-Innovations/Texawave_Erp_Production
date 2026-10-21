import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class CreateExchangeRateDto {
  @ApiProperty({ example: "USD" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase().trim() : value,
  )
  @IsString()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ example: "INR" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase().trim() : value,
  )
  @IsString()
  @Length(3, 3)
  toCurrency: string;

  @ApiProperty({ example: 83.25, minimum: 0.000001 })
  @IsNumber()
  @Min(0.000001)
  rate: number;

  @ApiProperty({ example: "2026-10-16" })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({ example: "manual", default: "manual" })
  @IsOptional()
  @IsString()
  source?: string;
}
