import { Module } from "@nestjs/common";
import { MailerService } from "../../../shared/mailer/mailer.service.js";
import { CustomersModule } from "../customers/customers.module.js";
import { SalesMasterListModule } from "../master-list/master-list.module.js";
import { DeliveryChallansController } from "./delivery-challans.controller.js";
import { DeliveryChallansRepository } from "./delivery-challans.repository.js";
import { DeliveryChallansService } from "./delivery-challans.service.js";
import { DocumentDeliveryRepository } from "./document-delivery.repository.js";
import { DocumentDeliveryService } from "./document-delivery.service.js";
import { DocumentFiguresRepository } from "./document-figures.repository.js";
import { DocumentFiguresService } from "./document-figures.service.js";
import { DocumentNumbersRepository } from "./document-numbers.repository.js";
import { DocumentPricingService } from "./document-pricing.service.js";
import { InvoicesController } from "./invoices.controller.js";
import { InvoicesRepository } from "./invoices.repository.js";
import { InvoicesService } from "./invoices.service.js";
import { QuotationsController } from "./quotations.controller.js";
import { QuotationsRepository } from "./quotations.repository.js";
import { QuotationsService } from "./quotations.service.js";
import { SalesPdfRenderer } from "./sales-pdf.renderer.js";

/** Sales documents: quotations, proforma/tax invoices (with payments) and
 * delivery challans. One module so each conversion (quotation → invoice,
 * proforma → tax, tax → DC) runs in a single transaction. */
@Module({
  imports: [CustomersModule, SalesMasterListModule],
  controllers: [
    QuotationsController,
    InvoicesController,
    DeliveryChallansController,
  ],
  providers: [
    QuotationsRepository,
    QuotationsService,
    InvoicesRepository,
    InvoicesService,
    DeliveryChallansRepository,
    DeliveryChallansService,
    DocumentPricingService,
    DocumentNumbersRepository,
    DocumentDeliveryRepository,
    DocumentDeliveryService,
    DocumentFiguresRepository,
    DocumentFiguresService,
    SalesPdfRenderer,
    MailerService,
  ],
  // Read by the Sales dashboard — the repositories stay private.
  exports: [DocumentFiguresService],
})
export class SalesDocumentsModule {}
