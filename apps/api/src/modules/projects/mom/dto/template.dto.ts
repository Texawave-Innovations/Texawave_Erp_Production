import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MomTemplateStatus } from "@texawave-erp/database";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

export class CreateMomTemplateDto {
  @ApiProperty({ example: "Standard Project Review Meeting" })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: "Dynamic MomSectionConfig[] schema" })
  @IsOptional()
  @IsArray()
  sectionsJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  defaultAgendaJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  defaultNoteRowsJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateMomTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: MomTemplateStatus })
  @IsOptional()
  @IsEnum(MomTemplateStatus)
  status?: MomTemplateStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  sectionsJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  defaultAgendaJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  defaultNoteRowsJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
