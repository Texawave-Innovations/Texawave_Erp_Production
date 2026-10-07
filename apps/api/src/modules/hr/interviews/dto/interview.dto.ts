import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

/** Legacy `InterviewStatus`, uppercased for storage. Any value may follow any
 * other (legacy has no transition guard). */
export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "SELECTED",
  "REJECTED",
  "NO_SHOW",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/** Legacy `InterviewMode`. */
export const INTERVIEW_MODES = ["ONLINE", "IN_PERSON", "PHONE"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export class CreateInterviewDto {
  @ApiProperty({ example: "Ramesh Kumar" })
  @Trim()
  @IsString()
  @Length(2, 120)
  candidateName!: string;

  @ApiProperty({ example: "Full Stack Developer" })
  @Trim()
  @IsString()
  @Length(2, 120)
  roleTitle!: string;

  @ApiProperty({
    example: "Tech Lead",
    description: "Free text, as legacy stores it. Not an employee reference",
  })
  @Trim()
  @IsString()
  @Length(2, 120)
  interviewerName!: string;

  @ApiProperty({ example: "2026-10-12" })
  @IsDateOnly()
  interviewDate!: string;

  @ApiProperty({ example: "14:30", description: "24-hour HH:MM" })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "interviewTime must be HH:MM",
  })
  interviewTime!: string;

  @ApiPropertyOptional({ enum: INTERVIEW_MODES, default: "ONLINE" })
  @IsOptional()
  @IsIn(INTERVIEW_MODES)
  mode?: InterviewMode;

  @ApiPropertyOptional({ description: "Resume links, topics, notes" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class UpdateInterviewStatusDto {
  @ApiProperty({ enum: INTERVIEW_STATUSES })
  @IsIn(INTERVIEW_STATUSES)
  status!: InterviewStatus;
}

export class QueryInterviewDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Case-insensitive match on candidate, role or interviewer",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  search?: string;

  @ApiPropertyOptional({ enum: INTERVIEW_STATUSES })
  @IsOptional()
  @IsIn(INTERVIEW_STATUSES)
  status?: InterviewStatus;
}
