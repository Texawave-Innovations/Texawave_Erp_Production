import { Module } from "@nestjs/common";
import { HtmlPdfRenderer } from "../../../shared/pdf/html-pdf-renderer.js";
import { ProfilesController } from "./profiles.controller.js";
import { ProfilesRepository } from "./profiles.repository.js";
import { ProfilesService } from "./profiles.service.js";

@Module({
  controllers: [ProfilesController],
  providers: [ProfilesRepository, ProfilesService, HtmlPdfRenderer],
})
export class ProfilesModule {}
