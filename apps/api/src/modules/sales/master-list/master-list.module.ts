import { Module } from "@nestjs/common";
import { CodeFormatsController } from "./code-formats.controller.js";
import { CodeFormatsRepository } from "./code-formats.repository.js";
import { CodeFormatsService } from "./code-formats.service.js";
import { CompanyProfileController } from "./company-profile.controller.js";
import { CompanyProfileRepository } from "./company-profile.repository.js";
import { CompanyProfileService } from "./company-profile.service.js";

/** Sales master list. Each Sales tab adds its configurable items here. */
@Module({
  controllers: [CodeFormatsController, CompanyProfileController],
  providers: [
    CodeFormatsRepository,
    CodeFormatsService,
    CompanyProfileRepository,
    CompanyProfileService,
  ],
  // Read by modules that issue codes (getFormat) and print documents
  // (require) — the repositories stay private.
  exports: [CodeFormatsService, CompanyProfileService],
})
export class SalesMasterListModule {}
