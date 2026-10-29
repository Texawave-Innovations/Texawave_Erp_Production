import { Module } from "@nestjs/common";
import { SalesMasterListModule } from "../master-list/master-list.module.js";
import { CustomersController } from "./customers.controller.js";
import { CustomersRepository } from "./customers.repository.js";
import { CustomersService } from "./customers.service.js";

@Module({
  imports: [SalesMasterListModule],
  controllers: [CustomersController],
  providers: [CustomersRepository, CustomersService],
  // Read by the Sales dashboard (countByStatus) — the repository stays private.
  exports: [CustomersService],
})
export class CustomersModule {}
