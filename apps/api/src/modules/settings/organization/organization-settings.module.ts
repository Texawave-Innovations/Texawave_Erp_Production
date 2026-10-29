import { Module } from "@nestjs/common";
import { AuditModule } from "../../../platform/audit/audit.module.js";
import { TenancyModule } from "../../../platform/tenancy/tenancy.module.js";
import { PrismaModule } from "../../../shared/prisma/prisma.module.js";
import { OrganizationSettingsController } from "./organization-settings.controller.js";
import { OrganizationSettingsRepository } from "./organization-settings.repository.js";
import { OrganizationSettingsService } from "./organization-settings.service.js";

@Module({
  imports: [PrismaModule, TenancyModule, AuditModule],
  controllers: [OrganizationSettingsController],
  providers: [OrganizationSettingsRepository, OrganizationSettingsService],
  exports: [OrganizationSettingsRepository, OrganizationSettingsService],
})
export class OrganizationSettingsModule {}
