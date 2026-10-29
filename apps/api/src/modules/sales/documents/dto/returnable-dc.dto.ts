import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
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
import { Trim } from "../../../../common/dto/transforms.js";
import { MAX_LINES } from "./document-parts.dto.js";

export const RDC_STATUSES = ["ISSUED", "RETURNED"] as const;
export type RdcStatus = (typeof RDC_STATUSES)[number];

/** One returnable item: what was lent and how many. */
export class ReturnableLineDto {
  @ApiProperty({ example: "Demo control panel" })
  @Trim()
  @IsString()
  @Length(1, 500)
  description!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999_999_999)
  quantity!: number;
}

export class CreateReturnableDcDto {
  @ApiProperty({ example: 1, description: "Recipient / client" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId!: number;

  @ApiProperty({ example: "2026-10-15" })
  @IsDateOnly()
  issueDate!: string;

  @ApiProperty({ example: "Demonstration / Testing" })
  @Trim()
  @IsString()
  @Length(1, 200)
  purpose!: string;

  @ApiProperty({ example: "2026-10-29", description: "≥ issueDate" })
  @IsDateOnly()
  expectedReturnDate!: string;

  @ApiPropertyOptional({ example: "Ravi (field engineer)" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  takenBy?: string | null;

  @ApiProperty({ type: [ReturnableLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => ReturnableLineDto)
  lines!: ReturnableLineDto[];

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

  @ApiPropertyOptional({
    example: 1,
    description:
      "A COMPANY_SEAL option of the master list; its label and image are printed",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sealItemId?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description:
      "An AUTHORIZED_SIGNATURE option of the master list; its label and image are printed",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  signatureItemId?: number | null;

  @ApiPropertyOptional({ example: "Rafic" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  preparedBy?: string | null;

  @ApiPropertyOptional({
    description: "Returnable terms; the standard text when omitted",
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

/** `lines`, when sent, replace every line. A returned RDC cannot be
 * edited — reopen it first. */
export class UpdateReturnableDcDto extends PartialType(CreateReturnableDcDto) {}

export class MarkReturnedDto {
  @ApiPropertyOptional({
    example: "2026-10-28",
    description: "Default today; ≥ issueDate",
  })
  @IsOptional()
  @IsDateOnly()
  returnedDate?: string;
}

export class QueryReturnableDcDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      "Case-insensitive search on RDC no, recipient, purpose, taken by and prepared by",
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

  @ApiPropertyOptional({ enum: RDC_STATUSES })
  @IsOptional()
  @IsIn(RDC_STATUSES)
  status?: RdcStatus;

  @ApiPropertyOptional({ example: "2026-10-15", description: "Issue date" })
  @IsOptional()
  @IsDateOnly()
  date?: string;

  @ApiPropertyOptional({ example: "2026-10", description: "Issue month" })
  @IsOptional()
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/, { message: "month must be YYYY-MM" })
  month?: string;
}
