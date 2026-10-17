import { Module } from "@nestjs/common";
import { RolesPermissionsModule } from "../../../platform/roles-permissions/roles-permissions.module.js";
import { AccountsModule } from "../accounts/accounts.module.js";
import { ActivitiesModule } from "../activities/activities.module.js";
import { CrmColdCallingModule } from "../cold-calling/cold-calling.module.js";
import { ContactsModule } from "../contacts/contacts.module.js";
import { LeadsModule } from "../leads/leads.module.js";
import { OpportunitiesModule } from "../opportunities/opportunities.module.js";
import { PipelineStagesModule } from "../pipeline-stages/pipeline-stages.module.js";
import { MeetingsModule } from "../meetings/meetings.module.js";
import { CrmMiningRowsModule } from "../mining-rows/mining-rows.module.js";
import { ProductsModule } from "../products/products.module.js";
import { QuotationsModule } from "../quotations/quotations.module.js";
import {
  BulkImportController,
  CrmCustomFieldsController,
} from "./bulk-import.controller.js";
import { BulkImportRepository } from "./bulk-import.repository.js";
import { BulkImportService } from "./bulk-import.service.js";

@Module({
  imports: [
    RolesPermissionsModule,
    LeadsModule,
    AccountsModule,
    ContactsModule,
    ProductsModule,
    CrmMiningRowsModule,
    CrmColdCallingModule,
    MeetingsModule,
    ActivitiesModule,
    QuotationsModule,
    OpportunitiesModule,
    PipelineStagesModule,
  ],
  controllers: [BulkImportController, CrmCustomFieldsController],
  providers: [BulkImportRepository, BulkImportService],
})
export class CrmBulkImportModule {}
