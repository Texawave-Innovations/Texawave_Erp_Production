import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export const QUOTATION_STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
  "Expired",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/QuoteForm.tsx
 * line-item table. Only the fields the user actually enters are accepted
 * — `listPrice`/`discountAmount`/`taxAmount`/`amount` are NEVER
 * client-supplied (approved decision D4,
 * Docs/CRM_QUOTES_LEGACY_PARITY.md §2.3/§6); the server always derives
 * `listPrice` from the live `Product` row (or `0` for a free-text line)
 * and computes the rest via `computeLineBreakdown`
 * (apps/api/src/modules/crm/shared/money.ts). `productId` is optional —
 * a line may be pure free text (confirmed in legacy, §1.3 of the audit). */
export class QuotationLineItemInputDto {
  @ApiPropertyOptional({
    description: "Omit for a free-text line with no catalog product",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 2000)
  description!: string;

  @ApiPropertyOptional({ example: "Nos" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  uom?: string;

  @ApiProperty({ minimum: 0.01 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: "Every quoted item needs a quantity greater than 0" })
  quantity!: number;

  /** The user-editable price actually quoted — NOT frozen to the
   * catalog's `listPrice`, unlike `OpportunityProduct.unitPrice`. See
   * Docs/CRM_QUOTES_LEGACY_PARITY.md §1.3/§3 for why this is the one
   * deliberate divergence from the Deal Products snapshot model. */
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: "No upper bound — matches legacy",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxPercent?: number;
}

/** Shared shape for both `POST /crm/quotations` (create) and
 * `PUT /crm/quotations/:id` (full replace-all, approved decision D2) —
 * legacy's single Save button always submits the complete header AND
 * the complete line-item array together, never a partial patch, so
 * there is deliberately no `PartialType` "update DTO" the way most other
 * CRM entities have one. */
export class QuotationPayloadDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId!: number;

  @ApiPropertyOptional({
    description: "Must belong to accountId and be OPEN — approved decision D5",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  opportunityId?: number;

  @ApiPropertyOptional({
    description: "Must belong to accountId — approved decision D5",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contactId?: number;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 300)
  subject!: string;

  @ApiPropertyOptional({ enum: QUOTATION_STATUSES, default: "Draft" })
  @IsOptional()
  @IsIn(QUOTATION_STATUSES)
  status?: QuotationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  quoteOwner?: string;

  @ApiPropertyOptional({ default: "INR" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 10)
  currency?: string;

  @ApiPropertyOptional({ description: "ISO date; defaults to today" })
  @IsOptional()
  @IsDateString()
  quoteDate?: string;

  @ApiProperty({ description: "ISO date; must be on or after quoteDate" })
  @IsDateString()
  validUntil!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  customerReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 250)
  billingStreet?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  billingCity?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  billingState?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  billingPostalCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  billingCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 250)
  shippingStreet?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  shippingCity?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  shippingState?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 20)
  shippingPostalCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  shippingCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  carrier?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  deliveryNotes?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  termsConditions?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  paymentTerms?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  deliveryTerms?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiPropertyOptional({
    default: 0,
    description:
      "Manual +/- adjustment — the one total-related field that IS a direct input, never computed",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  adjustment?: number;

  @ApiProperty({ type: [QuotationLineItemInputDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1, { message: "Add at least one quoted item" })
  @ValidateNested({ each: true })
  @Type(() => QuotationLineItemInputDto)
  items!: QuotationLineItemInputDto[];
}

export class QueryQuotationDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      "Matches quotationNumber/subject/account name (case-insensitive)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ enum: QUOTATION_STATUSES })
  @IsOptional()
  @IsIn(QUOTATION_STATUSES)
  status?: QuotationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  opportunityId?: number;
}
