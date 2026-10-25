import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { QueryBoolean } from "../../../../common/dto/transforms.js";

export const PROPOSAL_SORT_FIELDS = [
  "createdAt",
  "proposalNumber",
  "title",
  "dueDate",
  "updatedAt",
] as const;
export type ProposalSortField = (typeof PROPOSAL_SORT_FIELDS)[number];

export class CreateProposalDocumentDto {
  @ApiProperty({ example: "Leak Detection Automation — Phase 2 Proposal" })
  @IsString()
  @Length(2, 200)
  title!: string;

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
  @Type(() => Number)
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional({ description: "Section values keyed by section id" })
  @IsOptional()
  @IsObject()
  sectionValues?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  proposalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateProposalDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional()
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
  @Type(() => Number)
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sectionValues?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  proposalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  followUpNotes?: string;
}

export class TransitionProposalDto {
  @ApiProperty({
    example: "submit_for_review",
    description:
      "submit_for_review | review_approve | request_changes | send_to_client | record_accepted | record_rejected | revert_to_draft | archive",
  })
  @IsString()
  action!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export class ExtendFollowupDto {
  @ApiProperty({ example: "2026-11-15" })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class QueryProposalDocumentDto extends PaginationDto {
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

  @ApiPropertyOptional({ description: "Exact client name" })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional({
    description:
      "Only proposals whose follow-up is due today or overdue and still open (legacy 'Follow-ups Due' card)",
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  followUpDue?: boolean;

  @ApiPropertyOptional({ description: "Created on/after (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: "Created on/before (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ enum: PROPOSAL_SORT_FIELDS, default: "createdAt" })
  @IsOptional()
  @IsIn(PROPOSAL_SORT_FIELDS)
  sortBy?: ProposalSortField;
}
