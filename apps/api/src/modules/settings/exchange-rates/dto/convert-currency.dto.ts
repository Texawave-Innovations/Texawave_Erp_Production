import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

export class ConvertCurrencyDto {
  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiProperty({ example: "USD" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase().trim() : value,
  )
  @IsString()
  @Length(3, 3)
  from: string;

  @ApiProperty({ example: "INR" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase().trim() : value,
  )
  @IsString()
  @Length(3, 3)
  to: string;

  @ApiPropertyOptional({ example: "2026-10-16" })
  @IsOptional()
  @IsDateString()
  date?: string;
}
