import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  ValidateNested,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  FINANCE_PAYMENT_RECEIVED_STATUSES,
  type FinancePaymentReceivedStatus,
} from "../../finance.constants.js";
import { CreatePaymentAllocationDto } from "./create-allocation.dto.js";

export class CreatePaymentReceivedDto {
  @ApiPropertyOptional({
    example: "REC-202610-0001",
    description: "Unique receipt voucher number (auto-generated if omitted)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 50)
  paymentNumber?: string;

  @ApiProperty({
    example: "2026-10-23",
    description: "Date payment was received (ISO YYYY-MM-DD)",
  })
  @IsDateString()
  paymentDate!: string;

  @ApiPropertyOptional({
    example: 10,
    description: "CRM Account ID of the customer (if linked)",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  customerId?: number;

  @ApiProperty({
    example: "Globex Corporation",
    description: "Name of the customer or paying entity",
  })
  @Trim()
  @IsString()
  @Length(1, 200)
  customerName!: string;

  @ApiProperty({
    example: 10000.0,
    description: "Total amount received in transaction",
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiProperty({
    example: 2,
    description:
      "ID of active payment mode in Finance Master List (e.g. Bank Transfer, UPI)",
  })
  @IsInt()
  @IsPositive()
  paymentModeId!: number;

  @ApiPropertyOptional({
    example: 1,
    description: "ID of company bank account where funds were deposited",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  bankAccountId?: number;

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

  @ApiPropertyOptional({
    enum: FINANCE_PAYMENT_RECEIVED_STATUSES,
    default: "CONFIRMED",
    description:
      "Initial status of receipt (CONFIRMED automatically posts to GL; DRAFT does not)",
  })
  @IsOptional()
  @IsIn(FINANCE_PAYMENT_RECEIVED_STATUSES)
  status?: FinancePaymentReceivedStatus;

  @ApiPropertyOptional({
    type: [CreatePaymentAllocationDto],
    description: "Optional list of initial invoice allocations",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations?: CreatePaymentAllocationDto[];
}
