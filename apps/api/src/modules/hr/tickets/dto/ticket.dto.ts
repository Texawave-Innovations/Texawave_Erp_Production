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
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketStatus,
} from "../tickets.rules.js";

/** Production validation caps. Legacy had no length limits; these are a
 * PRODUCTION DECISION so one ticket cannot carry an unbounded body. */
export const TICKET_SUBJECT_MAX = 200;
export const TICKET_DESCRIPTION_MAX = 5000;
export const TICKET_COMMENT_MAX = 2000;

/** Admin-raised ticket. The raiser is never a field: it is the JWT user. */
export class CreateTicketDto {
  @ApiProperty({ description: "Employee the ticket is for" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @ApiProperty({ enum: TICKET_CATEGORIES })
  @IsIn(TICKET_CATEGORIES)
  category!: TicketCategory;

  @ApiProperty({ maxLength: TICKET_SUBJECT_MAX })
  @Trim()
  @IsString()
  @Length(1, TICKET_SUBJECT_MAX)
  subject!: string;

  @ApiProperty({ maxLength: TICKET_DESCRIPTION_MAX })
  @Trim()
  @IsString()
  @Length(1, TICKET_DESCRIPTION_MAX)
  description!: string;
}

/** Employee-raised ticket. There is deliberately NO employee field: the
 * requester is resolved from the JWT. The category set is narrower than the
 * admin's; the service enforces that rule (`assertEmployeeCategory`). */
export class CreateMyTicketDto {
  @ApiProperty({ enum: TICKET_CATEGORIES })
  @IsIn(TICKET_CATEGORIES)
  category!: TicketCategory;

  @ApiProperty({ maxLength: TICKET_SUBJECT_MAX })
  @Trim()
  @IsString()
  @Length(1, TICKET_SUBJECT_MAX)
  subject!: string;

  @ApiProperty({ maxLength: TICKET_DESCRIPTION_MAX })
  @Trim()
  @IsString()
  @Length(1, TICKET_DESCRIPTION_MAX)
  description!: string;
}

/** Employee edit. The legacy edit form always sends all three fields, so the
 * body replaces them together. */
export class UpdateMyTicketDto extends CreateMyTicketDto {}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: TICKET_STATUSES })
  @IsIn(TICKET_STATUSES)
  status!: TicketStatus;
}

export class CreateTicketCommentDto {
  @ApiProperty({ maxLength: TICKET_COMMENT_MAX })
  @Trim()
  @IsString()
  @Length(1, TICKET_COMMENT_MAX)
  body!: string;
}

/** Shared list filters. `q` matches the subject (and, on the HR list, the
 * employee's name), as the legacy search box did. */
class TicketFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TICKET_STATUSES })
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatus;

  @ApiPropertyOptional({
    description: "Subject, category or employee name contains",
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  q?: string;
}

/** HR list: scoped by `hr.ticket.read`. */
export class QueryTicketDto extends TicketFilterDto {
  @ApiPropertyOptional({ enum: TICKET_CATEGORIES })
  @IsOptional()
  @IsIn(TICKET_CATEGORIES)
  category?: TicketCategory;

  @ApiPropertyOptional({
    description: "Tickets of one employee (within scope)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}

/** Self-service list: always the caller's own tickets. */
export class QueryMyTicketDto extends TicketFilterDto {}
