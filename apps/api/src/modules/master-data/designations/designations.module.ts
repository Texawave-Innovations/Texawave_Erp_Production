import { Module } from "@nestjs/common";
import { DesignationsController } from "./designations.controller.js";
import { DesignationsRepository } from "./designations.repository.js";
import { DesignationsService } from "./designations.service.js";

@Module({
  controllers: [DesignationsController],
  providers: [DesignationsRepository, DesignationsService],
})
export class DesignationsModule {}
