import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

/** Mirrors legacy `ColdCallingRow` (TexaWave_ERP/src/modules/crm/
 * ColdCallingStatus.tsx) — raw cold-calling outcomes logged exactly as they
 * come out of the source spreadsheet (SINO / Date / Company Name / Prospect
 * Name / Designation / Status). `status` is deliberately free text, never a
 * fixed enum — legacy's own comment: "Status values are free text (never a
 * fixed enum — future outcomes must not require a code change)". */
export class CreateCrmColdCallingEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 50)
  serialNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  callDate?: string;

  @Trim()
  @IsString()
  @Length(1, 200)
  companyName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  prospectName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  status?: string;
}

export class UpdateCrmColdCallingEntryDto extends PartialType(
  CreateCrmColdCallingEntryDto,
) {}

/** Links this row to an Account — the only non-automatic bridge into the
 * Account.statusTag disposition queues. Matches legacy `handleLinkAccount`. */
export class LinkCrmColdCallingEntryDto {
  @IsInt()
  @Min(1)
  accountId!: number;
}

/** Records which disposition tag a row was routed to — informational only;
 * the actual Account.statusTag change happens via the existing
 * `PATCH /crm/accounts/:id/status-tag` endpoint. Matches legacy
 * `handleDispositionRecorded`. */
export class RecordCrmColdCallingDispositionDto {
  @IsString()
  @Length(1, 50)
  dispositionTag!: string;
}

export class QueryCrmColdCallingEntryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  linkedAccountId?: number;

  @ApiPropertyOptional({ description: "Exact match on the free-text status" })
  @IsOptional()
  @Trim()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "callDate >= (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "callDate <= (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
