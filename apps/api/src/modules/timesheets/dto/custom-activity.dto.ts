import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { IsDateOnly } from "../../../common/dates/date-only.js";
import {
  CUSTOM_ACTIVITY_CATEGORIES,
  type CustomActivityCategory,
} from "../timesheets.rules.js";

/** IST wall-clock time, `HH:mm`. The server turns it into an instant on the
 * work date — the browser never sends a timestamp for work it did not time. */
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A custom activity: work that is not an assigned project task (a meeting, a
 * discussion, research...). The employee is always the signed-in user. The
 * duration is calculated by the server from the two times.
 */
export class CreateCustomActivityDto {
  @ApiProperty({ enum: CUSTOM_ACTIVITY_CATEGORIES })
  @IsIn(CUSTOM_ACTIVITY_CATEGORIES)
  category!: CustomActivityCategory;

  @ApiProperty({ example: "Internal team discussion" })
  @IsString()
  @Length(1, 255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: "Remarks" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description:
      "A project the employee is a member of or holds a task in (optional).",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId?: number;

  @ApiProperty({ example: "2026-11-16", description: "The IST work date" })
  @IsDateOnly()
  workDate!: string;

  @ApiProperty({ example: "14:00", description: "Start, IST (HH:mm)" })
  @Matches(HH_MM, { message: "startTime must be a time as HH:mm" })
  startTime!: string;

  @ApiProperty({ example: "15:00", description: "End, IST (HH:mm)" })
  @Matches(HH_MM, { message: "endTime must be a time as HH:mm" })
  endTime!: string;

  @ApiPropertyOptional({
    description: "Required when the work date is before today (a late entry).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lateEntryReason?: string;
}

/** Any field may change; `projectId: null` removes the project link. */
export class UpdateCustomActivityDto extends PartialType(
  CreateCustomActivityDto,
) {}
