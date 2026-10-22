import { Module } from "@nestjs/common";
import { RolesPermissionsModule } from "../../../platform/roles-permissions/roles-permissions.module.js";
import { AccountsModule } from "../accounts/accounts.module.js";
import { ActivitiesModule } from "../activities/activities.module.js";
import { FollowUpsModule } from "../follow-ups/follow-ups.module.js";
import { MeetingsModule } from "../meetings/meetings.module.js";
import { OpportunitiesModule } from "../opportunities/opportunities.module.js";
import { CrmTasksModule } from "../tasks/tasks.module.js";
import { CrmCalendarController } from "./calendar.controller.js";
import { CrmCalendarService } from "./calendar.service.js";

@Module({
  imports: [
    RolesPermissionsModule,
    AccountsModule,
    MeetingsModule,
    FollowUpsModule,
    CrmTasksModule,
    ActivitiesModule,
    OpportunitiesModule,
  ],
  controllers: [CrmCalendarController],
  providers: [CrmCalendarService],
})
export class CrmCalendarModule {}
