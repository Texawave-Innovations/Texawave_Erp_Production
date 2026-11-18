import { Module } from "@nestjs/common";
import { TimesheetDayService } from "./timesheet-day.service.js";

/**
 * The daily timesheet layer's Prisma-only core. Deliberately free of any
 * dependency on Projects or HR so `ProjectsModule` can import it (the task
 * lifecycle writes the day's row inside its own transaction) while the later
 * review/reports module imports `ProjectsModule` — no import cycle.
 */
@Module({
  providers: [TimesheetDayService],
  exports: [TimesheetDayService],
})
export class TimesheetsCoreModule {}
