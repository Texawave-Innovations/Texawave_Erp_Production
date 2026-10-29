import { Module } from "@nestjs/common";
import { ScmMasterListItemsModule } from "../master-list-items/master-list-items.module.js";
import { InventoryController } from "./inventory.controller.js";
import { InventoryRepository } from "./inventory.repository.js";
import { InventoryService } from "./inventory.service.js";
import { StockPostingService } from "./stock-posting.service.js";

@Module({
  imports: [ScmMasterListItemsModule],
  controllers: [InventoryController],
  providers: [InventoryRepository, InventoryService, StockPostingService],
  // StockPostingService is the single stock write path other SCM modules
  // (Procurement GRN, Fulfillment, Returns, Quality) post through.
  exports: [InventoryService, StockPostingService],
})
export class InventoryModule {}
