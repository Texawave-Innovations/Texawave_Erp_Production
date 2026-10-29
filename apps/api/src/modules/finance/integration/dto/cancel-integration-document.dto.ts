import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CancelIntegrationDocumentDto {
  @ApiProperty({
    example: "INV-2026-001",
    description:
      "Invoice or bill reference number to cancel and reverse in Finance",
  })
  @IsNotEmpty()
  @IsString()
  documentReference!: string;

  @ApiProperty({
    example: "Customer requested cancellation prior to fulfillment",
    description: "Reason for cancellation",
  })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({
    example: "2026-10-23",
    description: "Date of cancellation reversal entry (defaults to today)",
  })
  @IsOptional()
  @IsDateString()
  cancellationDate?: string;
}
