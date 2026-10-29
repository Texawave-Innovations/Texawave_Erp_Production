import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";

export class CreatePaymentAllocationDto {
  @ApiProperty({
    example: "INV-202610-0012",
    description: "Invoice number or billing reference string being settled",
  })
  @Trim()
  @IsString()
  @Length(1, 100)
  invoiceReference!: string;

  @ApiProperty({
    example: 5000.0,
    description: "Amount to allocate towards this invoice",
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  allocatedAmount!: number;

  @ApiPropertyOptional({
    example: "Partial payment for milestone 1 deliverable",
    description: "Allocation notes or audit remarks",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}
