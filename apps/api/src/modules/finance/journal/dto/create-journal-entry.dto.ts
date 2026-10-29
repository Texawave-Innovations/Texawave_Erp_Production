import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  FINANCE_JOURNAL_ENTRY_TYPES,
  type FinanceJournalEntryType,
} from "../../finance.constants.js";
import { CreateJournalLineDto } from "./create-journal-line.dto.js";

export class CreateJournalEntryDto {
  @ApiPropertyOptional({
    example: "JV-202610-0001",
    description: "Unique journal voucher number (auto-generated if omitted)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 50)
  entryNumber?: string;

  @ApiProperty({
    example: "2026-10-23",
    description:
      "Date of the voucher transaction (ISO string format YYYY-MM-DD)",
  })
  @IsDateString()
  entryDate!: string;

  @ApiPropertyOptional({
    enum: FINANCE_JOURNAL_ENTRY_TYPES,
    default: "MANUAL",
    description: "Classification of journal voucher",
  })
  @IsOptional()
  @IsIn(FINANCE_JOURNAL_ENTRY_TYPES)
  entryType?: FinanceJournalEntryType;

  @ApiProperty({
    example: "Monthly office rent payment",
    description: "Explanation and business purpose of the voucher",
  })
  @Trim()
  @IsString()
  @Length(1, 500)
  narration!: string;

  @ApiPropertyOptional({
    example: "INV-9921",
    description: "External reference number (invoice, PO, or check)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  referenceNumber?: string;

  @ApiProperty({
    type: [CreateJournalLineDto],
    description: "Array of debit and credit lines (minimum 2 lines required)",
  })
  @IsArray()
  @ArrayMinSize(2, {
    message: "A journal voucher must have at least 2 lines (double-entry)",
  })
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
