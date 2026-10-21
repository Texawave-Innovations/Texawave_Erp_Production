import { Module } from "@nestjs/common";
import { TenancyModule } from "../../../platform/tenancy/tenancy.module.js";
import { PrismaModule } from "../../../shared/prisma/prisma.module.js";
import { OrganizationSettingsModule } from "../organization/organization-settings.module.js";
import { ExchangeRatesController } from "./exchange-rates.controller.js";
import { ExchangeRatesRepository } from "./exchange-rates.repository.js";
import { ExchangeRatesService } from "./exchange-rates.service.js";

@Module({
  imports: [PrismaModule, TenancyModule, OrganizationSettingsModule],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesRepository, ExchangeRatesService],
  exports: [ExchangeRatesRepository, ExchangeRatesService],
})
export class ExchangeRatesModule {}
