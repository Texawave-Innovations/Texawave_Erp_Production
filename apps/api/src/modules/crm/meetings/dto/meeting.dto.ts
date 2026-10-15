import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  RELATED_TYPES,
  type RelatedType,
} from "../../shared/related-entity.js";

export const MEETING_MODES = ["Online", "Onsite", "Phone", "Demo"] as const;
/** Mirrors legacy `CrmMeetingStatus` (domain/types.ts) exactly. */
export const MEETING_STATUSES = [
  "REQUESTED",
  "TENTATIVE",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export class CreateMeetingDto {
  @IsIn(RELATED_TYPES)
  relatedType!: RelatedType;

  @IsInt()
  @Min(1)
  relatedId!: number;

  @ApiPropertyOptional({ enum: MEETING_MODES })
  @IsOptional()
  @IsIn(MEETING_MODES)
  mode?: (typeof MEETING_MODES)[number];

  @IsDateString()
  meetingDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 500)
  meetingLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agenda?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  participants?: string;
}

export class UpdateMeetingDto extends PartialType(
  OmitType(CreateMeetingDto, ["relatedType", "relatedId"] as const),
) {}

export class UpdateMeetingStatusDto {
  @IsIn(MEETING_STATUSES)
  status!: MeetingStatus;
}

/** Mirrors legacy `completeCrmMeeting`'s outcome-capture fields exactly. */
export class CompleteMeetingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  concerns?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competitors?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budget?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 200)
  decisionMaker?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedTimeline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;
}

export class RescheduleMeetingDto {
  @IsDateString()
  newDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class QueryMeetingDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(RELATED_TYPES)
  relatedType?: RelatedType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  relatedId?: number;

  @ApiPropertyOptional({ enum: MEETING_STATUSES })
  @IsOptional()
  @IsIn(MEETING_STATUSES)
  status?: MeetingStatus;
}
