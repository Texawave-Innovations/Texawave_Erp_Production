import { Module } from "@nestjs/common";
import { AuthModule } from "../../../platform/auth/auth.module.js";
import { OrgChartController } from "./org-chart.controller.js";
import { OrgChartRepository } from "./org-chart.repository.js";
import { OrgChartService } from "./org-chart.service.js";

@Module({
  imports: [AuthModule],
  controllers: [OrgChartController],
  providers: [OrgChartRepository, OrgChartService],
})
export class OrgChartModule {}
