import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class RecordExpensePaymentDto {
  @ApiPropertyOptional({
    example: 2,
    description:
      "ID of active payment mode in Finance Master List (e.g. Bank Transfer, Cash)",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  paymentModeId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "ID of company bank account used to disburse funds",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  bankAccountId?: number;

  @ApiPropertyOptional({
    example: "2026-10-23",
    description:
      "Date payment was disbursed (defaults to current date if omitted)",
  })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({
    example: "Paid via NEFT ref #892837198",
    description: "Payment or settlement transaction notes",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}
