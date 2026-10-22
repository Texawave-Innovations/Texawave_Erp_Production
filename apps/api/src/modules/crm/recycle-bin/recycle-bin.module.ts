import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module.js";
import { ActivitiesModule } from "../activities/activities.module.js";
import { CrmColdCallingModule } from "../cold-calling/cold-calling.module.js";
import { ContactsModule } from "../contacts/contacts.module.js";
import { CrmDocumentsModule } from "../documents/documents.module.js";
import { FollowUpsModule } from "../follow-ups/follow-ups.module.js";
import { LeadsModule } from "../leads/leads.module.js";
import { MeetingsModule } from "../meetings/meetings.module.js";
import { CrmMiningRowsModule } from "../mining-rows/mining-rows.module.js";
import { CrmNotesModule } from "../notes/notes.module.js";
import { OpportunitiesModule } from "../opportunities/opportunities.module.js";
import { PipelineStagesModule } from "../pipeline-stages/pipeline-stages.module.js";
import { ProductsModule } from "../products/products.module.js";
import { CrmQuotasModule } from "../quotas/quotas.module.js";
import { QuotationsModule } from "../quotations/quotations.module.js";
import { CrmTasksModule } from "../tasks/tasks.module.js";
import { RecycleBinController } from "./recycle-bin.controller.js";
import { RecycleBinRepository } from "./recycle-bin.repository.js";
import { RecycleBinHandlers } from "./recycle-bin.handlers.js";
import { RecycleBinService } from "./recycle-bin.service.js";

@Module({
  imports: [
    AccountsModule,
    LeadsModule,
    ContactsModule,
    OpportunitiesModule,
    PipelineStagesModule,
    ProductsModule,
    QuotationsModule,
    MeetingsModule,
    FollowUpsModule,
    ActivitiesModule,
    CrmTasksModule,
    CrmDocumentsModule,
    CrmNotesModule,
    CrmColdCallingModule,
    CrmMiningRowsModule,
    CrmQuotasModule,
  ],
  controllers: [RecycleBinController],
  providers: [RecycleBinHandlers, RecycleBinRepository, RecycleBinService],
})
export class CrmRecycleBinModule {}
