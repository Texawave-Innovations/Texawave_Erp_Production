import { Module } from "@nestjs/common";
import { UsersModule } from "../../../platform/users/users.module.js";
import { ProjectsModule } from "../projects.module.js";
import { ProposalDocumentsController } from "./proposal-documents.controller.js";
import { ProposalDocumentsService } from "./proposal-documents.service.js";
import { ProposalSettingsController } from "./proposal-settings.controller.js";
import { ProposalSettingsService } from "./proposal-settings.service.js";
import { ProposalTemplatesController } from "./proposal-templates.controller.js";
import { ProposalTemplatesService } from "./proposal-templates.service.js";
import { ProposalsRepository } from "./proposals.repository.js";

@Module({
  imports: [UsersModule, ProjectsModule],
  // `/proposals/templates` and `/proposals/settings` must register before
  // ProposalDocumentsController's `/proposals/:id` — otherwise those paths
  // are matched by `:id` and rejected by ParseIntPipe with a 400.
  controllers: [
    ProposalTemplatesController,
    ProposalSettingsController,
    ProposalDocumentsController,
  ],
  providers: [
    ProposalsRepository,
    ProposalDocumentsService,
    ProposalTemplatesService,
    ProposalSettingsService,
  ],
  exports: [ProposalDocumentsService],
})
export class ProposalsModule {}
