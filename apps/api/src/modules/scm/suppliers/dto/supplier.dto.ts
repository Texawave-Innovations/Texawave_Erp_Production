import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";

export const SUPPLIER_STATUSES = [
  "Active",
  "Inactive",
  "Pending Approval",
  "Blocked",
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

/** Same patterns legacy's `formValidators.ts` uses (a GSTIN embeds a PAN). */
export const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/** Optional text fields arrive as "" from the form; "" means "clear it", so
 * format validators only run on a non-empty value. */
const present = (_: unknown, value: unknown) =>
  value !== undefined && value !== null && value !== "";

/** Migrated from the LEGACY TexaWave_ERP_old/src/modules/scm/suppliers
 * ScmSupplierFormDialog. Required: company name, primary contact name and
 * supplier code (the code is server-allocated when omitted). GSTIN/PAN are
 * format-validated, currency must be a 3-letter code, rating 1-5. Email
 * format validation is a deliberate improvement over legacy, which only had
 * `type="email"` browser hinting (Docs/SCM_LEGACY_PARITY.md section 3). */
export class CreateSupplierDto {
  @ApiPropertyOptional({
    example: "VEND-0001",
    description: "Allocated by the server (next VEND-NNNN) when omitted",
  })
  @IsOptional()
  @UpperTrim()
  @IsString()
  @Length(1, 50)
  supplierCode?: string;

  @ApiProperty({ example: "ABC Suppliers Pvt Ltd" })
  @Trim()
  @IsString()
  @Length(1, 200)
  companyName!: string;

  @ApiPropertyOptional({ example: "Manufacturer" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  type?: string;

  @ApiPropertyOptional({ enum: SUPPLIER_STATUSES, default: "Active" })
  @IsOptional()
  @IsIn(SUPPLIER_STATUSES)
  status?: SupplierStatus;

  @ApiPropertyOptional({ example: "33AAAAA0000A1Z5" })
  @IsOptional()
  @UpperTrim()
  @ValidateIf(present)
  @Matches(GSTIN_PATTERN, { message: "Invalid GSTIN format" })
  gstin?: string;

  @ApiPropertyOptional({ example: "ABCDE1234F" })
  @IsOptional()
  @UpperTrim()
  @ValidateIf(present)
  @Matches(PAN_PATTERN, { message: "Invalid PAN format (e.g., ABCDE1234F)" })
  pan?: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 150)
  contactPerson!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @ValidateIf(present)
  @Matches(/^\d{1,15}$/, { message: "Phone must be digits only (max 15)" })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @ValidateIf(present)
  @IsEmail({}, { message: "Invalid email address" })
  @Length(1, 200)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  state?: string;

  @ApiPropertyOptional({ default: "India" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @ValidateIf(present)
  @Matches(/^\d{1,6}$/, { message: "Postal code must be digits only (max 6)" })
  pincode?: string;

  @ApiPropertyOptional({ example: "30 Days" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  paymentTerms?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: "INR" })
  @IsOptional()
  @UpperTrim()
  @Matches(/^[A-Z]{3}$/, {
    message: "Currency must be a 3-letter ISO code (e.g., INR, USD)",
  })
  currency?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class QuerySupplierDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      "Matches code/company/contact/email/phone/GSTIN (case-insensitive)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: SUPPLIER_STATUSES })
  @IsOptional()
  @IsIn(SUPPLIER_STATUSES)
  status?: SupplierStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  type?: string;
}
