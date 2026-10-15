import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const ACCOUNT_TYPES = [
  "Prospect",
  "Customer",
  "Partner",
  "Vendor",
  "Reseller",
] as const;
export const CUSTOMER_CATEGORIES = [
  "Enterprise",
  "Mid-Market",
  "SMB",
  "Individual",
] as const;
export const CUSTOMER_CLASSES = ["A", "B", "C"] as const;
export const BUSINESS_TYPES = [
  "Manufacturer",
  "Distributor",
  "Retailer",
  "Service Provider",
  "Reseller",
  "Other",
] as const;
/** Mirrors legacy `CrmStatusTag` (domain/types.ts) exactly — the
 * `AccountStatusQueue`/`StatusTagDialog` engagement-posture tag. */
export const ACCOUNT_STATUS_TAGS = [
  "Interested",
  "Not Interested",
  "Keep in Touch",
  "Call Back",
  "Send Info",
] as const;
export type AccountStatusTag = (typeof ACCOUNT_STATUS_TAGS)[number];

/** Phase 0 (Account-360 foundation) expanded this from the Phase 4B
 * minimal `{name}` foundation to legacy `AccountFormDialog.tsx`'s 5 tabs —
 * only `name` is required, matching legacy's own single client-side save
 * guard exactly. */
export class CreateAccountDto {
  @ApiProperty({ example: "Acme Corp" })
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ enum: ACCOUNT_TYPES })
  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  accountType?: (typeof ACCOUNT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  linkedin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  numberOfEmployees?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  billingStreet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  billingCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  billingState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  billingPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  billingCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  shippingStreet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  shippingCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  shippingState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  shippingPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  shippingCountry?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_CATEGORIES })
  @IsOptional()
  @IsIn(CUSTOMER_CATEGORIES)
  customerCategory?: (typeof CUSTOMER_CATEGORIES)[number];

  @ApiPropertyOptional({ enum: CUSTOMER_CLASSES })
  @IsOptional()
  @IsIn(CUSTOMER_CLASSES)
  customerClass?: (typeof CUSTOMER_CLASSES)[number];

  @ApiPropertyOptional({ enum: BUSINESS_TYPES })
  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: (typeof BUSINESS_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  resellerType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class QueryAccountDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Name contains (case-insensitive)" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  search?: string;

  @ApiPropertyOptional({ enum: ACCOUNT_STATUS_TAGS })
  @IsOptional()
  @IsIn(ACCOUNT_STATUS_TAGS)
  statusTag?: AccountStatusTag;
}

/** Mirrors legacy `StatusTagDialog`'s per-tag required companion field
 * exactly — enforced at the service layer (`AccountsService.changeStatusTag`),
 * not here, since which field is required depends on the chosen tag. */
export class ChangeAccountStatusTagDto {
  @IsIn(ACCOUNT_STATUS_TAGS)
  statusTag!: AccountStatusTag;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statusReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statusDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statusInfoType?: string;
}
