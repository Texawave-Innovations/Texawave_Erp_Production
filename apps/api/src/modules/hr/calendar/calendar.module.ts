import { Module } from "@nestjs/common";
import { CalendarController } from "./calendar.controller.js";
import { CalendarRepository } from "./calendar.repository.js";
import { CalendarQueryService, CalendarService } from "./calendar.service.js";

@Module({
  controllers: [CalendarController],
  providers: [CalendarRepository, CalendarService, CalendarQueryService],
  // Only the public lookup leaves this module — never a repository.
  exports: [CalendarQueryService],
})
export class CalendarModule {}
