import { Module } from "@nestjs/common";
import { RolesPermissionsModule } from "../../../platform/roles-permissions/roles-permissions.module.js";
import { CrmOverallDataRepository } from "../overall-data/overall-data.repository.js";
import { CrmQuotasModule } from "../quotas/quotas.module.js";
import { CrmDashboardController } from "./dashboard.controller.js";
import { CrmDashboardRepository } from "./dashboard.repository.js";
import { CrmDashboardService } from "./dashboard.service.js";

@Module({
  imports: [RolesPermissionsModule, CrmQuotasModule],
  controllers: [CrmDashboardController],
  // The Overall Data repository is a read-only loader that only needs
  // PrismaService; it is provided here (rather than exported from its own
  // module) so today's counters share the tracker's exact derivation.
  providers: [
    CrmDashboardRepository,
    CrmDashboardService,
    CrmOverallDataRepository,
  ],
})
export class CrmDashboardModule {}
