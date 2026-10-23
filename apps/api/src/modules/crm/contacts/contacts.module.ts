import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module.js";
import { ContactsController } from "./contacts.controller.js";
import { ContactsRepository } from "./contacts.repository.js";
import { ContactsService } from "./contacts.service.js";

@Module({
  imports: [AccountsModule],
  controllers: [ContactsController],
  providers: [ContactsRepository, ContactsService],
  exports: [ContactsRepository, ContactsService],
})
export class ContactsModule {}
