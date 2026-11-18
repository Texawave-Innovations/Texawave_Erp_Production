import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";

export class CreateMomDocumentDto {
  @ApiProperty({ example: "Weekly Project Review" })
  @IsString()
  @Length(2, 200)
  meetingTitle!: string;

  @ApiProperty({ example: "2026-11-05" })
  @IsDateString()
  meetingDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional({ description: "MomAttendee[]" })
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  attendeesJson?: unknown[];

  @ApiPropertyOptional({ description: "MomAttendee[] (absent)" })
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  absenteesJson?: unknown[];

  @ApiPropertyOptional({ description: "MomAgendaItem[]" })
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  agendaJson?: unknown[];

  @ApiPropertyOptional({ description: "MomNoteRow[]" })
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  meetingNotesJson?: unknown[];

  @ApiPropertyOptional({ description: "MomAdditionalSection[]" })
  @IsOptional()
  @IsArray()
  @Type(() => Object)
  additionalSectionsJson?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  freeTextContent?: string;
}

export class UpdateMomDocumentDto extends CreateMomDocumentDto {
  @ApiPropertyOptional({
    description:
      "Optimistic-concurrency token from the last read; omit to skip the check",
  })
  @IsOptional()
  @IsString()
  versionToken?: string;
}

export class StartMomRevisionDto {
  @ApiProperty({
    description:
      "Why the finalized minutes are being revised — recorded permanently in the audit trail (legacy required this before unlocking a revision)",
    example: "Corrected action item owners",
  })
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export const MOM_SORT_FIELDS = [
  "meetingDate",
  "reference",
  "meetingTitle",
  "updatedAt",
] as const;
export type MomSortField = (typeof MOM_SORT_FIELDS)[number];

export class QueryMomDocumentDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @ApiPropertyOptional({ description: "Meeting date on/after (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: "Meeting date on/before (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ enum: MOM_SORT_FIELDS, default: "meetingDate" })
  @IsOptional()
  @IsIn(MOM_SORT_FIELDS)
  sortBy?: MomSortField;
}
