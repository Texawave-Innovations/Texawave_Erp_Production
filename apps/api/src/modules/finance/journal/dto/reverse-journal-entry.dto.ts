import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, Length } from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class ReverseJournalEntryDto {
  @ApiPropertyOptional({
    example: "2026-10-23",
    description: "Date of reversal entry (defaults to current date)",
  })
  @IsOptional()
  @IsDateString()
  reversalDate?: string;

  @ApiPropertyOptional({
    example: "Reversal due to billing discrepancy",
    description: "Reason / narration for the reversal voucher",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
