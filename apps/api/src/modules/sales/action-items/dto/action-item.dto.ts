import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length } from "class-validator";
import { IsDateOnly } from "../../../../common/dates/date-only.js";
import { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import { Trim } from "../../../../common/dto/transforms.js";

export class CreateActionItemDto {
  @ApiProperty({ example: "Call Global Enterprises about PO" })
  @Trim()
  @IsString()
  @Length(1, 300)
  title!: string;

  @ApiPropertyOptional({ example: "2026-10-20" })
  @IsOptional()
  @IsDateOnly()
  dueDate?: string;
}

export const ACTION_ITEM_STATES = ["open", "done", "all"] as const;
export type ActionItemState = (typeof ACTION_ITEM_STATES)[number];

export class QueryActionItemDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ACTION_ITEM_STATES, default: "open" })
  @IsOptional()
  @IsIn(ACTION_ITEM_STATES)
  state?: ActionItemState;
}
