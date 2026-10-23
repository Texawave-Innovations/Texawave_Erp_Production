import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module.js";
import { OpportunitiesController } from "./opportunities.controller.js";
import { OpportunitiesRepository } from "./opportunities.repository.js";
import { OpportunitiesService } from "./opportunities.service.js";
import { OpportunityProductsRepository } from "./opportunity-products.repository.js";
import { OpportunityProductsService } from "./opportunity-products.service.js";

@Module({
  imports: [AccountsModule],
  controllers: [OpportunitiesController],
  providers: [
    OpportunitiesRepository,
    OpportunitiesService,
    OpportunityProductsRepository,
    OpportunityProductsService,
  ],
  exports: [
    OpportunityProductsRepository,
    OpportunitiesRepository,
    OpportunitiesService,
  ],
})
export class OpportunitiesModule {}
