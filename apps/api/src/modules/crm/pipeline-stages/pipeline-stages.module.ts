import { Module } from "@nestjs/common";
import { PipelineStagesController } from "./pipeline-stages.controller.js";
import { PipelineStagesRepository } from "./pipeline-stages.repository.js";
import { PipelineStagesService } from "./pipeline-stages.service.js";

@Module({
  controllers: [PipelineStagesController],
  providers: [PipelineStagesRepository, PipelineStagesService],
  exports: [PipelineStagesRepository],
})
export class PipelineStagesModule {}
