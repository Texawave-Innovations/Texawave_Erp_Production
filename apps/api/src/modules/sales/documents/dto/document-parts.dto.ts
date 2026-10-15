import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";
import { IFSC_PATTERN } from "../../shared/gst.js";

/**
 * DTO pieces shared by quotations, invoices and delivery challans. Every
 * amount the server can compute (line amounts, taxes, totals) is NOT
 * accepted from the client.
 */

const HSN = /^[0-9]{4,8}$/;
const STATE_CODE = /^[0-9]{2}$/;
export const MAX_LINES = 200;

/** A money value the user types: ≥ 0, up to 2 dp. */
function Money(max = 999_999_999_999) {
  return applyDecorators(
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }),
    Min(0),
    Max(max),
  );
}

/** A quantity: > 0, up to 3 dp. */
function Quantity() {
  return applyDecorators(
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 }),
    Min(0.001),
    Max(999_999_999),
  );
}

/** A tax percentage the user types in (0–100, up to 2 dp). No default. */
function TaxRate() {
  return applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 }),
    Min(0),
    Max(100),
  );
}

export class PricedLineDto {
  @ApiProperty({ example: "Industrial control panel" })
  @Trim()
  @IsString()
  @Length(1, 500)
  description!: string;

  @ApiPropertyOptional({ example: "8471" })
  @IsOptional()
  @Trim()
  @Matches(HSN, { message: "hsnCode must be 4-8 digits" })
  hsnCode?: string | null;

  @ApiProperty({ example: 1 })
  @Quantity()
  quantity!: number;

  @ApiProperty({ example: 600, description: "Rupees, up to 2 decimals" })
  @Money()
  unitPrice!: number;
}

export class DispatchLineDto {
  @ApiProperty({ example: "Industrial control panel" })
  @Trim()
  @IsString()
  @Length(1, 500)
  description!: string;

  @ApiPropertyOptional({ example: "8471" })
  @IsOptional()
  @Trim()
  @Matches(HSN, { message: "hsnCode must be 4-8 digits" })
  hsnCode?: string | null;

  @ApiProperty({ example: 1 })
  @Quantity()
  quantity!: number;
}

/** The bank block printed on the document (the company's own account). */
export class BankDetailsDto {
  @ApiPropertyOptional({ example: "HDFC Bank" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 150)
  bankName?: string;

  @ApiPropertyOptional({ example: "235767577457" })
  @IsOptional()
  @Trim()
  @Matches(/^[0-9]{6,20}$/, { message: "accountNumber must be 6-20 digits" })
  accountNumber?: string;

  @ApiPropertyOptional({ example: "Main Branch" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 150)
  branch?: string;

  @ApiPropertyOptional({ example: "HDFC0001256" })
  @IsOptional()
  @UpperTrim()
  @Matches(IFSC_PATTERN, { message: "ifsc must be a valid IFSC" })
  ifsc?: string;
}

/** Fields common to quotations and invoices. */
export class PricedDocumentDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId!: number;

  @ApiProperty({ type: [PricedLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => PricedLineDto)
  lines!: PricedLineDto[];

  @ApiPropertyOptional({
    example: "33",
    description:
      "GST state the supply is to. Defaults to the customer's state (else its default billing address); same as the company's state → CGST+SGST, else IGST",
  })
  @IsOptional()
  @Matches(STATE_CODE, {
    message: "placeOfSupply must be a two-digit GST state code",
  })
  placeOfSupply?: string | null;

  @ApiPropertyOptional({ example: "Freight & Transportation Charges" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  transportDescription?: string | null;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Money()
  transportCharge?: number;

  @ApiPropertyOptional({ example: "9965" })
  @IsOptional()
  @Trim()
  @Matches(HSN, { message: "transportHsn must be 4-8 digits" })
  transportHsn?: string | null;

  @ApiPropertyOptional({
    example: 9,
    description: "Falls back to the customer's rate; no built-in default",
  })
  @TaxRate()
  cgstRate?: number | null;

  @ApiPropertyOptional({ example: 9 })
  @TaxRate()
  sgstRate?: number | null;

  @ApiPropertyOptional({
    example: 18,
    description: "Inter-state only; CGST + SGST when not entered",
  })
  @TaxRate()
  igstRate?: number | null;

  @ApiPropertyOptional({ type: BankDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankDetailsDto)
  bankDetails?: BankDetailsDto | null;

  @ApiPropertyOptional({ example: "Texawave Official Corporate Seal" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  sealName?: string | null;

  @ApiPropertyOptional({ example: "Managing Director Signature" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  signatureName?: string | null;

  @ApiPropertyOptional({ example: "Rafic" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  preparedBy?: string | null;

  @ApiPropertyOptional({
    description: "Terms / declaration, one per line",
  })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  terms?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

/** List filters shared by every document list. */
export class DocumentQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Case-insensitive search on number, customer and prepared-by",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @ApiPropertyOptional({ example: "2026-10-01", description: "Inclusive" })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: "2026-10-31", description: "Inclusive" })
  @IsOptional()
  @IsDateOnly()
  to?: string;
}

/** "Send Email": defaults to the customer's email and a standard text. */
export class SendDocumentEmailDto {
  @ApiPropertyOptional({
    type: [String],
    description: "Defaults to the customer's email",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  to?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 200)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  message?: string;
}

/** `GET …/next-number?date=`: which financial year to preview. */
export class NextNumberQueryDto {
  @ApiPropertyOptional({ example: "2026-10-15", description: "Default today" })
  @IsOptional()
  @IsDateOnly()
  date?: string;
}
