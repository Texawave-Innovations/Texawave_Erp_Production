import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Body of `POST /projects/tasks/:taskId/timer/stop`. A plain stop (no flags)
 * only closes the running session, exactly as before. The two flags make the
 * stop also change the task, in one transaction:
 *  - `pause`    puts the task on hold (resume = start the timer again);
 *  - `complete` completes the task and pays its points once.
 * They are mutually exclusive. The employee and every timestamp come from the
 * signed-in user and the server clock, never from this body.
 */
export class StopTimerDto {
  @ApiPropertyOptional({
    example: "Wired the OEE chart to live data",
    description: "Work note saved with the session",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: "Also put the task on hold" })
  @IsOptional()
  @IsBoolean()
  pause?: boolean;

  @ApiPropertyOptional({ description: "Also complete the task" })
  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
