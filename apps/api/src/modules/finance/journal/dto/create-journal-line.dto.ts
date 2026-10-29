import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class CreateJournalLineDto {
  @ApiProperty({ example: 1, description: "Finance account ID" })
  @IsInt()
  @IsPositive()
  accountId!: number;

  @ApiPropertyOptional({
    example: 1500.0,
    default: 0,
    description: "Debit amount (must be positive, credit must be 0)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  debit?: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: "Credit amount (must be positive, debit must be 0)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit?: number;

  @ApiPropertyOptional({
    example: "Line specific memo",
    description: "Optional line item description",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 255)
  description?: string;
}
