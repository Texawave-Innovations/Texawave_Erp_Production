import { Module } from "@nestjs/common";
import { AuthorizedSignaturesController } from "./authorized-signatures.controller.js";
import { AuthorizedSignaturesService } from "./authorized-signatures.service.js";
import { AuthorizedSignatoryController } from "./authorized-signatory.controller.js";
import { AuthorizedSignatoryRepository } from "./authorized-signatory.repository.js";
import { AuthorizedSignatoryService } from "./authorized-signatory.service.js";
import { BankAccountsController } from "./bank-accounts.controller.js";
import { BankAccountsRepository } from "./bank-accounts.repository.js";
import { BankAccountsService } from "./bank-accounts.service.js";
import { CompanyDetailController } from "./company-detail.controller.js";
import { CompanyDetailRepository } from "./company-detail.repository.js";
import { CompanyDetailService } from "./company-detail.service.js";
import { CompanySealsController } from "./company-seals.controller.js";
import { CompanySealsService } from "./company-seals.service.js";
import { DocumentNumberingController } from "./document-numbering.controller.js";
import { DocumentNumberingRepository } from "./document-numbering.repository.js";
import { DocumentNumberingService } from "./document-numbering.service.js";
import { MasterListItemsController } from "./master-list-items.controller.js";
import { MasterListItemsRepository } from "./master-list-items.repository.js";
import { MasterListItemsService } from "./master-list-items.service.js";
import { SalespersonsController } from "./salespersons.controller.js";
import { SalespersonsRepository } from "./salespersons.repository.js";
import { SalespersonsService } from "./salespersons.service.js";
import { SealSignaturesRepository } from "./seal-signatures.repository.js";

/** Sales & Document Masters foundation — Docs/SALES_SETTINGS_FOUNDATION.md.
 * One Nest module for every tab of the "Sales & Document Masters" page
 * (Sales Settings: Company/Numbering/Bank & Signatory/Salespersons; Seals &
 * Signatures; Terms & Inventory) since they are one settings surface, not
 * independent business entities — each resource still keeps its own
 * controller/service/repository (Docs/CODING_STANDARDS.md §3). */
@Module({
  controllers: [
    CompanyDetailController,
    DocumentNumberingController,
    BankAccountsController,
    AuthorizedSignatoryController,
    SalespersonsController,
    CompanySealsController,
    AuthorizedSignaturesController,
    MasterListItemsController,
  ],
  providers: [
    CompanyDetailRepository,
    CompanyDetailService,
    DocumentNumberingRepository,
    DocumentNumberingService,
    BankAccountsRepository,
    BankAccountsService,
    AuthorizedSignatoryRepository,
    AuthorizedSignatoryService,
    SalespersonsRepository,
    SalespersonsService,
    SealSignaturesRepository,
    CompanySealsService,
    AuthorizedSignaturesService,
    MasterListItemsRepository,
    MasterListItemsService,
  ],
})
export class SalesSettingsModule {}
