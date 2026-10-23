import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean, Trim } from "../../../../common/dto/transforms.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/domain/
 * contactsService.ts (RTDB `crm/contacts`). `name` and `accountId` are
 * hard-required, mirroring the legacy Contacts.tsx client-side save guard
 * (`if (!form.name.trim() || !form.accountId) return;`). */
export class CreateContactDto {
  @ApiProperty({ description: "The account this contact belongs to" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId!: number;

  @ApiProperty({ example: "Jane Doe" })
  @Trim()
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  whatsapp?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDecisionMaker?: boolean;
}

/** `accountId` is intentionally omittable from an update: legacy has no
 * "move contact to another account" flow. Re-parenting is not built here;
 * if ever needed it should be its own explicit endpoint, not a silent side
 * effect of a general PATCH. */
export class UpdateContactDto extends PartialType(CreateContactDto) {}

export class QueryContactDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Matches name/designation/email/phone (case-insensitive)",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  q?: string;

  @ApiPropertyOptional({ description: "Contacts of exactly this account" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isDecisionMaker?: boolean;
}
