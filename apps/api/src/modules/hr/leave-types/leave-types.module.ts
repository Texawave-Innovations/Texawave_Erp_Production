import { Module } from "@nestjs/common";
import { LeaveTypesController } from "./leave-types.controller.js";
import { LeaveTypesRepository } from "./leave-types.repository.js";
import { LeaveTypesService } from "./leave-types.service.js";

@Module({
  controllers: [LeaveTypesController],
  providers: [LeaveTypesRepository, LeaveTypesService],
})
export class LeaveTypesModule {}
