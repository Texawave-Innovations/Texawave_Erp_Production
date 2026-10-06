import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  CODE_MESSAGE,
  CODE_PATTERN,
  Trim,
  UpperTrim,
} from "../../../../common/dto/transforms.js";

export class CreateLeaveTypeDto {
  @ApiProperty({ example: "CASUAL", description: "Immutable once created" })
  @UpperTrim()
  @IsString()
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;

  @ApiProperty({ example: "Casual leave" })
  @Trim()
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ description: "Send an empty string to clear" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    default: true,
    description: "Paid leave draws on the balance; unpaid leave is not limited",
  })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional({
    default: 0,
    description:
      "Default annual entitlement in days, accrued monthly (1/12 per credited month). Employees start at 0 until HR sets an entitlement.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(366)
  annualEntitlement?: number;

  @ApiPropertyOptional({
    default: 0,
    description:
      "Unused days at year end are carried forward up to this many days; the rest is forfeited.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(366)
  carryForwardLimit?: number;
}
