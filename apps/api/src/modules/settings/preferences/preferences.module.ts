import { Module } from "@nestjs/common";
import { TenancyModule } from "../../../platform/tenancy/tenancy.module.js";
import { PrismaModule } from "../../../shared/prisma/prisma.module.js";
import { OrganizationSettingsModule } from "../organization/organization-settings.module.js";
import { PreferencesController } from "./preferences.controller.js";
import { PreferencesRepository } from "./preferences.repository.js";
import { PreferencesService } from "./preferences.service.js";

@Module({
  imports: [PrismaModule, TenancyModule, OrganizationSettingsModule],
  controllers: [PreferencesController],
  providers: [PreferencesRepository, PreferencesService],
  exports: [PreferencesRepository, PreferencesService],
})
export class PreferencesModule {}
