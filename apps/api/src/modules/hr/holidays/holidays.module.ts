import { Module } from "@nestjs/common";
import { HolidaysController } from "./holidays.controller.js";
import { HolidaysRepository } from "./holidays.repository.js";
import { HolidaysService } from "./holidays.service.js";

@Module({
  controllers: [HolidaysController],
  providers: [HolidaysRepository, HolidaysService],
})
export class HolidaysModule {}
