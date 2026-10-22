import { Module } from "@nestjs/common";
import { RolesPermissionsModule } from "../../../platform/roles-permissions/roles-permissions.module.js";
import { AccountsModule } from "../accounts/accounts.module.js";
import { CrmColdCallingModule } from "../cold-calling/cold-calling.module.js";
import { ContactsModule } from "../contacts/contacts.module.js";
import { FollowUpsModule } from "../follow-ups/follow-ups.module.js";
import { LeadsModule } from "../leads/leads.module.js";
import { MeetingsModule } from "../meetings/meetings.module.js";
import { CrmMiningRowsModule } from "../mining-rows/mining-rows.module.js";
import { OpportunitiesModule } from "../opportunities/opportunities.module.js";
import { CrmSearchController } from "./search.controller.js";
import { CrmSearchService } from "./search.service.js";

@Module({
  imports: [
    RolesPermissionsModule,
    AccountsModule,
    ContactsModule,
    OpportunitiesModule,
    MeetingsModule,
    FollowUpsModule,
    LeadsModule,
    CrmColdCallingModule,
    CrmMiningRowsModule,
  ],
  controllers: [CrmSearchController],
  providers: [CrmSearchService],
})
export class CrmSearchModule {}
