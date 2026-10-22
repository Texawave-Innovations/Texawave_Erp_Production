import { Module } from "@nestjs/common";
import { CrmDocumentsController } from "./documents.controller.js";
import { CrmDocumentsRepository } from "./documents.repository.js";
import { CrmDocumentsService } from "./documents.service.js";

@Module({
  controllers: [CrmDocumentsController],
  providers: [CrmDocumentsRepository, CrmDocumentsService],
  exports: [CrmDocumentsRepository],
})
export class CrmDocumentsModule {}
