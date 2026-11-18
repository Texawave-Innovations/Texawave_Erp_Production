import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  ValidateIf,
} from "class-validator";

/** Turn Do Not Disturb on or off. A timed snooze gives `until` (at most 7 days
 * ahead); "until I turn it off" gives `indefinite: true`; neither turns it off. */
export class SetDndDto {
  @ApiPropertyOptional({
    nullable: true,
    example: "2026-11-16T12:00:00.000Z",
    description: "End of a timed snooze, an ISO 8601 instant. null = none.",
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  until?: string | null;

  @ApiPropertyOptional({ description: "Snooze until the user turns it off." })
  @IsOptional()
  @IsBoolean()
  indefinite?: boolean;
}
