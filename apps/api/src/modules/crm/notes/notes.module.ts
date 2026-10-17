import { Module } from "@nestjs/common";
import { CrmNotesController } from "./notes.controller.js";
import { CrmNotesRepository } from "./notes.repository.js";
import { CrmNotesService } from "./notes.service.js";

@Module({
  controllers: [CrmNotesController],
  providers: [CrmNotesRepository, CrmNotesService],
  exports: [CrmNotesRepository],
})
export class CrmNotesModule {}
