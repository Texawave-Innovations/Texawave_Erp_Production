import { Module } from "@nestjs/common";
import { WorkLocationsController } from "./work-locations.controller.js";
import { WorkLocationsRepository } from "./work-locations.repository.js";
import { WorkLocationsService } from "./work-locations.service.js";

@Module({
  controllers: [WorkLocationsController],
  providers: [WorkLocationsRepository, WorkLocationsService],
})
export class WorkLocationsModule {}
