import { Module } from "@nestjs/common";
import { ShiftsController } from "./shifts.controller.js";
import { ShiftsRepository } from "./shifts.repository.js";
import { ShiftsService } from "./shifts.service.js";

@Module({
  controllers: [ShiftsController],
  providers: [ShiftsRepository, ShiftsService],
})
export class ShiftsModule {}
