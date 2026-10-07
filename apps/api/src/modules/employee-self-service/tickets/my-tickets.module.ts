import { Module } from "@nestjs/common";
import { TicketsModule } from "../../hr/tickets/tickets.module.js";
import { MyTicketsController } from "./my-tickets.controller.js";

@Module({
  imports: [TicketsModule],
  controllers: [MyTicketsController],
})
export class MyTicketsModule {}
