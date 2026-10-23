import { Module } from "@nestjs/common";
import { CrmTasksModule } from "../tasks/tasks.module.js";
import { AccountsController } from "./accounts.controller.js";
import { AccountsRepository } from "./accounts.repository.js";
import { AccountsService } from "./accounts.service.js";

@Module({
  imports: [CrmTasksModule],
  controllers: [AccountsController],
  providers: [AccountsRepository, AccountsService],
  // ContactsModule validates accountId through this service.
  exports: [AccountsService, AccountsRepository],
})
export class AccountsModule {}
