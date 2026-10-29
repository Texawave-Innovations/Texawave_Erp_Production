import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";
import { CreateJournalLineDto } from "./create-journal-line.dto.js";

export class UpdateJournalEntryDto {
  @ApiPropertyOptional({
    example: "2026-10-23",
    description: "Updated voucher transaction date",
  })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiPropertyOptional({
    example: "Updated explanation of the voucher",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 500)
  narration?: string;

  @ApiPropertyOptional({
    example: "REF-002",
    description: "External reference number",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  referenceNumber?: string | null;

  @ApiPropertyOptional({
    type: [CreateJournalLineDto],
    description: "Updated array of journal lines (replaces all existing lines)",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, {
    message: "A journal voucher must have at least 2 lines (double-entry)",
  })
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines?: CreateJournalLineDto[];
}
