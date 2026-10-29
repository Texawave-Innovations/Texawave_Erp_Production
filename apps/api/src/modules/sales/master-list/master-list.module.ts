import { Module } from "@nestjs/common";
import { CodeFormatsController } from "./code-formats.controller.js";
import { CodeFormatsRepository } from "./code-formats.repository.js";
import { CodeFormatsService } from "./code-formats.service.js";
import { CompanyProfileController } from "./company-profile.controller.js";
import { CompanyProfileRepository } from "./company-profile.repository.js";
import { CompanyProfileService } from "./company-profile.service.js";
import { DocumentFieldsController } from "./document-fields.controller.js";
import { DocumentFieldsRepository } from "./document-fields.repository.js";
import { DocumentFieldsService } from "./document-fields.service.js";
import { RunningNumbersController } from "./running-numbers.controller.js";
import { RunningNumbersRepository } from "./running-numbers.repository.js";
import { RunningNumbersService } from "./running-numbers.service.js";

/** Sales master list. Each Sales tab adds its configurable items here.
 * The document master list is three pages: running numbers, company
 * details, and document fields. */
@Module({
  controllers: [
    CodeFormatsController,
    CompanyProfileController,
    RunningNumbersController,
    DocumentFieldsController,
  ],
  providers: [
    CodeFormatsRepository,
    CodeFormatsService,
    CompanyProfileRepository,
    CompanyProfileService,
    RunningNumbersRepository,
    RunningNumbersService,
    DocumentFieldsRepository,
    DocumentFieldsService,
  ],
  // Read by modules that issue codes (getFormat), print documents
  // (require, logoDataUri) and choose seals, signatures and payment modes (resolveOption,
  // imageDataUri) — the repositories stay private.
  exports: [CodeFormatsService, CompanyProfileService, DocumentFieldsService],
})
export class SalesMasterListModule {}
