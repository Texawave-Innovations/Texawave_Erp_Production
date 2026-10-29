import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length } from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { Trim } from "../../../../common/dto/transforms.js";
import { DocumentQueryDto, PricedDocumentDto } from "./document-parts.dto.js";

export const QUOTATION_STATUSES = ["OPEN", "CONVERTED"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export class CreateQuotationDto extends PricedDocumentDto {
  @ApiProperty({
    example: "2026-10-15",
    description: "Its financial year decides the number (TW/QUO/26-27/…)",
  })
  @IsDateOnly()
  quotationDate!: string;

  @ApiPropertyOptional({ example: "30 Days" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 50)
  validity?: string | null;

  @ApiPropertyOptional({ example: "2-3 Weeks" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  deliveryTerms?: string | null;
}

/** `lines`, when sent, replace every line. The number never changes, even
 * if the date moves to another financial year. */
export class UpdateQuotationDto extends PartialType(CreateQuotationDto) {}

export class QueryQuotationDto extends DocumentQueryDto {
  @ApiPropertyOptional({ enum: QUOTATION_STATUSES })
  @IsOptional()
  @IsIn(QUOTATION_STATUSES)
  status?: QuotationStatus;
}
