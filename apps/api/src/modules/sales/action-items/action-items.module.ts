import { Module } from "@nestjs/common";
import { ActionItemsController } from "./action-items.controller.js";
import { ActionItemsRepository } from "./action-items.repository.js";
import { ActionItemsService } from "./action-items.service.js";

@Module({
  controllers: [ActionItemsController],
  providers: [ActionItemsRepository, ActionItemsService],
  // Read by the Sales dashboard (countOpen) — the repository stays private.
  exports: [ActionItemsService],
})
export class ActionItemsModule {}
