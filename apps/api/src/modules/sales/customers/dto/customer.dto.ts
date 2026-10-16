import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  FIELD_FORMAT,
  FIELD_MESSAGE,
} from "../../../../common/dto/field-formats.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { CALLING_CODES } from "../../shared/countries.js";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";
import { CIN_PATTERN, GSTIN_PATTERN } from "../../shared/gst.js";

/** Letters, spaces, and . ' - (the shared name format). */
const Name = () => Matches(FIELD_FORMAT.name, { message: FIELD_MESSAGE.name });

export const CUSTOMER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const ADDRESS_TYPES = ["BILLING", "SHIPPING"] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

const STATE_CODE = /^[0-9]{2}$/;

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

/** One address from the "Add Billing/Shipping Address" dialog. */
export class CustomerAddressDto {
  @ApiProperty({ enum: ADDRESS_TYPES })
  @IsIn(ADDRESS_TYPES)
  addressType!: AddressType;

  @ApiProperty({ example: "Head Office" })
  @Trim()
  @IsString()
  @Length(1, 100)
  label!: string;

  @ApiProperty({ example: "No. 12, Industrial Estate" })
  @Trim()
  @IsString()
  @Length(1, 500)
  street!: string;

  @ApiPropertyOptional({ example: "Guindy" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  @ValidateIf((_o, v) => typeof v === "string" && v !== "")
  @Name()
  area?: string;

  @ApiProperty({ example: "Chennai" })
  @Trim()
  @IsString()
  @Length(1, 100)
  @Name()
  city!: string;

  @ApiProperty({ example: "33", description: "Two-digit GST state code" })
  @Matches(STATE_CODE, {
    message: "stateCode must be a two-digit GST state code",
  })
  stateCode!: string;

  @ApiProperty({ example: "600032" })
  @Trim()
  @Matches(FIELD_FORMAT.pincode, { message: FIELD_MESSAGE.pincode })
  pincode!: string;

  @ApiPropertyOptional({ default: "India" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  @Name()
  country?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateCustomerDto {
  @ApiProperty({ example: "ABC Industries Pvt Ltd" })
  @Trim()
  @IsString()
  @Length(1, 200)
  @Matches(/[A-Za-z]/, {
    message: "Enter a company name (it must contain letters).",
  })
  companyName!: string;

  @ApiProperty({ example: "John Doe" })
  @Trim()
  @IsString()
  @Length(1, 150)
  @Name()
  contactPerson!: string;

  @ApiProperty({ example: "john@company.com" })
  @Trim()
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @ApiPropertyOptional({
    example: "+91",
    default: "+91",
    enum: CALLING_CODES,
    description:
      "Also decides the country in the customer code (+91 → CUS-IN-001); the code never changes afterwards",
  })
  @IsOptional()
  @IsIn(CALLING_CODES, {
    message: "mobileCountryCode is not a supported country code",
  })
  mobileCountryCode?: string;

  @ApiProperty({ example: "9876543210" })
  @Trim()
  @Matches(/^[0-9]{6,15}$/, { message: "mobileNumber must be 6-15 digits" })
  mobileNumber!: string;

  @ApiPropertyOptional({ example: "33AAAAA0000A1Z5" })
  @IsOptional()
  @UpperTrim()
  @Matches(GSTIN_PATTERN, {
    message: "gstin must be a valid 15-character GSTIN",
  })
  gstin?: string | null;

  @ApiPropertyOptional({
    example: "33",
    description: "Defaults to the GSTIN's state; may be edited",
  })
  @IsOptional()
  @Matches(STATE_CODE, {
    message: "stateCode must be a two-digit GST state code",
  })
  stateCode?: string | null;

  @ApiPropertyOptional({
    example: 9,
    description: "Entered manually, no default",
  })
  @TaxRate()
  cgstRate?: number | null;

  @ApiPropertyOptional({
    example: 9,
    description: "Entered manually, no default",
  })
  @TaxRate()
  sgstRate?: number | null;

  @ApiPropertyOptional({
    example: 18,
    description: "Entered manually, no default",
  })
  @TaxRate()
  igstRate?: number | null;

  @ApiPropertyOptional({ example: "ABCDE1234F" })
  @IsOptional()
  @UpperTrim()
  @Matches(FIELD_FORMAT.pan, { message: FIELD_MESSAGE.pan })
  pan?: string | null;

  @ApiPropertyOptional({ example: "L12345MH2020PLC123456" })
  @IsOptional()
  @UpperTrim()
  @Matches(CIN_PATTERN, { message: "cin must be a valid 21-character CIN" })
  cin?: string | null;

  @ApiPropertyOptional({ example: "HDFC Bank" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 150)
  @Name()
  bankName?: string | null;

  @ApiPropertyOptional({
    example: "50100234567890",
    description: "Stored encrypted; responses show only the last 4 digits",
  })
  @IsOptional()
  @Trim()
  @Matches(FIELD_FORMAT.accountNumber, {
    message: FIELD_MESSAGE.accountNumber,
  })
  bankAccountNumber?: string | null;

  @ApiPropertyOptional({ example: "HDFC0001234" })
  @IsOptional()
  @UpperTrim()
  @Matches(FIELD_FORMAT.ifsc, { message: FIELD_MESSAGE.ifsc })
  bankIfsc?: string | null;

  @ApiPropertyOptional({ example: "Industrial Area Branch" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 150)
  @Name()
  bankBranch?: string | null;

  @ApiPropertyOptional({ example: "UPI: abc@hdfcbank" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  paymentNotes?: string | null;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: CustomerStatus;

  @ApiPropertyOptional({
    type: [CustomerAddressDto],
    description: "On update, replaces every address when present",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CustomerAddressDto)
  addresses?: CustomerAddressDto[];

  @ApiPropertyOptional({
    description: "Arbitrary extra fields, not queried/filtered/joined",
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class QueryCustomerDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      "Case-insensitive search on code, company, contact, email, phone, GSTIN and city",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: CustomerStatus;
}

export class NextCustomerCodeQueryDto {
  @ApiPropertyOptional({ example: "+91", default: "+91", enum: CALLING_CODES })
  @IsOptional()
  @IsIn(CALLING_CODES, {
    message: "mobileCountryCode is not a supported country code",
  })
  mobileCountryCode?: string;
}
