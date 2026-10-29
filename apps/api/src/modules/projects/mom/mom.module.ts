import { Module } from "@nestjs/common";
import { UsersModule } from "../../../platform/users/users.module.js";
import { ProjectsModule } from "../projects.module.js";
import { MomDocumentsController } from "./mom-documents.controller.js";
import { MomDocumentsService } from "./mom-documents.service.js";
import { MomTemplatesController } from "./mom-templates.controller.js";
import { MomTemplatesService } from "./mom-templates.service.js";
import { MomRepository } from "./mom.repository.js";

@Module({
  imports: [UsersModule, ProjectsModule],
  // MomTemplatesController (`/mom/templates`) must register before
  // MomDocumentsController's `/mom/:id` — otherwise `GET /mom/templates` is
  // matched by `:id` and rejected by ParseIntPipe with a 400.
  controllers: [MomTemplatesController, MomDocumentsController],
  providers: [MomRepository, MomDocumentsService, MomTemplatesService],
  exports: [MomDocumentsService],
})
export class MomModule {}
