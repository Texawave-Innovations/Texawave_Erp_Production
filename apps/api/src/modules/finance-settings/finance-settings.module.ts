import { Module } from "@nestjs/common";
import { MasterListItemsController } from "./master-list-items.controller.js";
import { MasterListItemsRepository } from "./master-list-items.repository.js";
import { MasterListItemsService } from "./master-list-items.service.js";

/** Finance Master foundation — Docs/FINANCE_MASTER_LIST.md. Currently one
 * resource (master list items behind the Expense Types / Payment Modes
 * cards); future Finance-module settings tabs join this module the same way
 * apps/api/src/modules/sales-settings grew beyond its first resource. */
@Module({
  controllers: [MasterListItemsController],
  providers: [MasterListItemsRepository, MasterListItemsService],
})
export class FinanceSettingsModule {}
