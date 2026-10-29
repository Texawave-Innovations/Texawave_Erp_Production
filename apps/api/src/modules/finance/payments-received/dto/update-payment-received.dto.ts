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

export class UpdatePaymentReceivedDto {
  @ApiPropertyOptional({
    example: "2026-10-23",
    description: "Date payment was received (ISO YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({
    example: 10,
    description: "CRM Account ID of the customer (if linked)",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  customerId?: number;

  @ApiPropertyOptional({
    example: "Globex Corporation",
    description: "Name of the customer or paying entity",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 200)
  customerName?: string;

  @ApiPropertyOptional({
    example: "NEFT-92817482910",
    description: "External banking transaction reference or UTR number",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  referenceNumber?: string;

  @ApiPropertyOptional({
    example: "INV-202610-0012",
    description: "Primary sales invoice reference number",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  invoiceReference?: string;

  @ApiPropertyOptional({
    example: "Advance payment against annual maintenance contract",
    description: "Internal receipt notes or remarks",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}
