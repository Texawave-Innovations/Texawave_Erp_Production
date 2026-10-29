import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim, UpperTrim } from "../../../../common/dto/transforms.js";
import {
  CHECKPOINT_RESULTS,
  INSPECTION_STATUSES,
  INSPECTION_TYPES,
  QUALITY_CONDITIONS,
  QUALITY_DISPOSITIONS,
  QUARANTINE_STATUSES,
} from "../quality.helpers.js";

const bool = ({ value }: { value: unknown }) =>
  value === "true" ? true : value === "false" ? false : value;

// ---- defects ----------------------------------------------------------------

export class CreateDefectDto {
  @ApiProperty({ example: "DMG-01" })
  @UpperTrim()
  @IsString()
  @Length(1, 50)
  defectCode!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty()
  @Trim()
  @IsString()
  category!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  severity!: string;
}

/** The code is the defect's identity on past inspections, so it is fixed. */
export class UpdateDefectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QueryDefectDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  active?: boolean;
}

// ---- templates --------------------------------------------------------------

export class CheckpointDto {
  @ApiPropertyOptional({
    description: "Keep when editing so past results stay linked",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 60)
  checkpointId?: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiProperty()
  @IsBoolean()
  required!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  expectedValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 30)
  unit?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ example: "GRN-STD" })
  @UpperTrim()
  @IsString()
  @Length(1, 50)
  templateCode!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({ enum: INSPECTION_TYPES })
  @IsIn(INSPECTION_TYPES)
  inspectionType!: (typeof INSPECTION_TYPES)[number];

  @ApiProperty({ type: [CheckpointDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckpointDto)
  checkpoints!: CheckpointDto[];
}

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [CheckpointDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckpointDto)
  checkpoints?: CheckpointDto[];
}

export class QueryTemplateDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: INSPECTION_TYPES })
  @IsOptional()
  @IsIn(INSPECTION_TYPES)
  inspectionType?: (typeof INSPECTION_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  active?: boolean;
}

// ---- inspections ------------------------------------------------------------

export class CreateInspectionDto {
  @ApiProperty({ enum: INSPECTION_TYPES })
  @IsIn(INSPECTION_TYPES)
  inspectionType!: (typeof INSPECTION_TYPES)[number];

  @ApiPropertyOptional({
    description:
      "GRN / return / fulfillment id (INCOMING / CUSTOMER_RETURN / PRE_DISPATCH). Lines are derived server-side from the source document.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceId?: number;

  @ApiPropertyOptional({ description: "INVENTORY inspections only" })
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number;

  @ApiPropertyOptional({ description: "INVENTORY inspections only" })
  @IsOptional()
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @ApiPropertyOptional({ description: "INVENTORY inspections only" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  templateId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class CheckpointResultDto {
  @ApiProperty()
  @Trim()
  @IsString()
  checkpointId!: string;

  @ApiProperty({ enum: CHECKPOINT_RESULTS })
  @IsIn(CHECKPOINT_RESULTS)
  result!: (typeof CHECKPOINT_RESULTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  observedValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @UpperTrim()
  @IsString()
  @Length(0, 50)
  defectCode?: string;
}

export class RecordItemResultDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  inspectedQuantity!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  acceptedQuantity!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  rejectedQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  manualHold?: boolean;

  @ApiPropertyOptional({ enum: QUALITY_CONDITIONS })
  @IsOptional()
  @IsIn(QUALITY_CONDITIONS)
  condition?: (typeof QUALITY_CONDITIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @UpperTrim()
  @IsString()
  @Length(0, 50)
  defectCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  defectDescription?: string;

  @ApiPropertyOptional({ enum: QUALITY_DISPOSITIONS })
  @IsOptional()
  @IsIn(QUALITY_DISPOSITIONS)
  disposition?: (typeof QUALITY_DISPOSITIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @ApiPropertyOptional({ type: [CheckpointResultDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckpointResultDto)
  checkpointResults?: CheckpointResultDto[];
}

export class StartInspectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 150)
  inspectorName?: string;
}

export class QcReasonDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(1, 1000)
  reason!: string;
}

export class QueryInspectionDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: INSPECTION_TYPES })
  @IsOptional()
  @IsIn(INSPECTION_TYPES)
  inspectionType?: (typeof INSPECTION_TYPES)[number];

  @ApiPropertyOptional({ enum: INSPECTION_STATUSES })
  @IsOptional()
  @IsIn(INSPECTION_STATUSES)
  status?: (typeof INSPECTION_STATUSES)[number];
}

export class QuerySourcesDto {
  @ApiProperty({ enum: INSPECTION_TYPES })
  @IsIn(INSPECTION_TYPES)
  inspectionType!: (typeof INSPECTION_TYPES)[number];
}

// ---- quarantine -------------------------------------------------------------

export class QueryQuarantineDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: QUARANTINE_STATUSES })
  @IsOptional()
  @IsIn(QUARANTINE_STATUSES)
  status?: (typeof QUARANTINE_STATUSES)[number];
}

export class QuarantineActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class QueryActivityDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;
}
