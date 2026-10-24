import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePaymentMadeDto {
  @ApiPropertyOptional({
    description: "Payment disbursement date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: "Recipient vendor or supplier name" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  vendorName?: string;

  @ApiPropertyOptional({
    description: "Cheque, UTR, or transaction reference number",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: "Purchase bill reference or supplier invoice number",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  billReference?: string;

  @ApiPropertyOptional({ description: "Internal notes or remarks" })
  @IsOptional()
  @IsString()
  notes?: string;
}
