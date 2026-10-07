import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  EXIT_REQUEST_STATUSES,
  type ExitRequestStatus,
  SETTLEMENT_STATUSES,
  type SettlementStatus,
} from "../exit-request-domain.js";

/** Production guard on free text. Legacy sets no maximum length. */
const MAX_TEXT = 2000;

/** There is deliberately NO `employeeId`: a request is always for the
 * authenticated user's own employee record, resolved from the JWT. */
export class CreateExitRequestDto {
  @ApiProperty({ description: "Reason for leaving (required in legacy)" })
  @Trim()
  @IsString()
  @Length(1, MAX_TEXT)
  reason!: string;

  @ApiProperty({
    example: "2026-11-30",
    description: "Preferred last working day; not before today",
  })
  @IsDateOnly()
  preferredLastWorkingDate!: string;

  @ApiPropertyOptional({
    example: 30,
    default: 30,
    description:
      "Notice period in days, entered by the employee. Stored as input only; no policy is applied (legacy default 30).",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  noticePeriodDays?: number;

  @ApiPropertyOptional({ description: "Handover notes, pending work" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, MAX_TEXT)
  additionalNotes?: string;
}

/** HR decision and/or update. Every field is optional, but at least one must be
 * sent (checked in the service). An empty `hrNote` clears the note. */
export class UpdateExitRequestDto {
  @ApiPropertyOptional({
    enum: EXIT_REQUEST_STATUSES,
    description:
      "Move to a new status along the transition map. Omit it to edit the fields only; naming the current status is refused.",
  })
  @IsOptional()
  @IsIn(EXIT_REQUEST_STATUSES)
  status?: ExitRequestStatus;

  @ApiPropertyOptional({
    example: "2026-11-30",
    description: "Confirmed last working day, set by HR",
  })
  @IsOptional()
  @IsDateOnly()
  confirmedLastWorkingDate?: string;

  @ApiPropertyOptional({ enum: SETTLEMENT_STATUSES })
  @IsOptional()
  @IsIn(SETTLEMENT_STATUSES)
  settlementStatus?: SettlementStatus;

  @ApiPropertyOptional({ description: "Note shown to the employee" })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, MAX_TEXT)
  hrNote?: string;
}

/** HR list: scoped by `hr.exit_request.read`. */
export class QueryExitRequestDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EXIT_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(EXIT_REQUEST_STATUSES)
  status?: ExitRequestStatus;

  @ApiPropertyOptional({ description: "Requests of one employee (in scope)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}

/** Self-service list: always the caller's own requests. */
export class QueryMyExitRequestDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EXIT_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(EXIT_REQUEST_STATUSES)
  status?: ExitRequestStatus;
}
