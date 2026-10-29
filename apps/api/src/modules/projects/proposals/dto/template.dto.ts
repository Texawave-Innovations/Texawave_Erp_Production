import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { ProposalTemplateStatus } from "@texawave-erp/database";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

export class CreateProposalTemplateDto {
  @ApiProperty({ example: "Standard Engineering Proposal" })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiProperty({ example: "Standard Engineering Proposal" })
  @IsString()
  @Length(2, 200)
  title!: string;

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
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: "Dynamic ProposalSectionConfig[] schema",
  })
  @IsOptional()
  @IsArray()
  schemaJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateProposalTemplateDto {
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
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ProposalTemplateStatus })
  @IsOptional()
  @IsEnum(ProposalTemplateStatus)
  status?: ProposalTemplateStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  schemaJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
