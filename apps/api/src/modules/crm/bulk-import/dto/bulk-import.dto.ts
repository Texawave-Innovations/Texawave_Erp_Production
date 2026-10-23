import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Trim } from "../../../../common/dto/transforms.js";
import { CUSTOM_FIELD_MODULES } from "../bulk-import.fields.js";

/** Hard cap on rows per commit request (and headers per match request). The
 * UI chunks larger workbooks into several requests. */
export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_HEADERS = 200;
export const MAX_EXPORT_ROWS = 10000;

export const DUPLICATE_STRATEGIES = ["skip", "update", "create"] as const;
export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number];

export class ImportRowDto {
  @ApiProperty({ description: "1-based data row number (excludes header)" })
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ApiProperty({
    description: "field key -> raw cell text for each mapped column",
  })
  @IsObject()
  values!: Record<string, string>;

  @ApiPropertyOptional({
    description:
      "Unrecognised columns: original header text -> raw cell text. Each header auto-creates (idempotently) a custom field definition.",
  })
  @IsOptional()
  @IsObject()
  custom?: Record<string, string>;
}

export class CommitImportDto {
  @ApiProperty({ enum: DUPLICATE_STRATEGIES })
  @IsIn(DUPLICATE_STRATEGIES)
  strategy!: DuplicateStrategy;

  @ApiPropertyOptional({
    description:
      "Validate + detect duplicates only; nothing is written (no rows, no custom field defs).",
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiProperty({ type: [ImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

export class MatchHeadersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_HEADERS)
  @IsString({ each: true })
  @Length(0, 300, { each: true })
  headers!: string[];
}

export class QueryCustomFieldsDto {
  @ApiPropertyOptional({ enum: CUSTOM_FIELD_MODULES })
  @IsOptional()
  @IsIn(CUSTOM_FIELD_MODULES)
  module?: (typeof CUSTOM_FIELD_MODULES)[number];
}

export class QueryExportDto {
  @ApiPropertyOptional({ description: "Same search the list page applies" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 100)
  search?: string;

  @ApiPropertyOptional({ default: MAX_EXPORT_ROWS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_EXPORT_ROWS)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  // Read the raw query string: with implicit conversion enabled globally,
  // the already-converted value would turn "false" into true.
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    return raw === "true" ? true : raw === "false" ? false : raw;
  })
  @IsBoolean()
  includeCustomFields?: boolean;
}
