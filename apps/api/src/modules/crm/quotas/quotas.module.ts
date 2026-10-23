import { Module } from "@nestjs/common";
import { CrmQuotasController } from "./quotas.controller.js";
import { CrmQuotasRepository } from "./quotas.repository.js";
import { CrmQuotasService } from "./quotas.service.js";

@Module({
  controllers: [CrmQuotasController],
  providers: [CrmQuotasRepository, CrmQuotasService],
  exports: [CrmQuotasRepository, CrmQuotasService],
})
export class CrmQuotasModule {}
