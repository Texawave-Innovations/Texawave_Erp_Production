import { Module } from "@nestjs/common";
import { FinanceModule as FinanceCoreModule } from "../../finance/finance.module.js";
import { ScmCommonModule } from "../common/scm-common.module.js";
import { ScmProductsModule } from "../products/products.module.js";
import { CustomersRepository } from "./customers.repository.js";
import { CustomersService } from "./customers.service.js";
import { SalesOrdersRepository } from "./sales-orders.repository.js";
import { SalesOrdersService } from "./sales-orders.service.js";
import {
  CustomersController,
  SalesOrdersController,
} from "./sales.controller.js";

@Module({
  imports: [ScmProductsModule, ScmCommonModule, FinanceCoreModule],
  controllers: [CustomersController, SalesOrdersController],
  providers: [
    CustomersRepository,
    CustomersService,
    SalesOrdersRepository,
    SalesOrdersService,
  ],
  exports: [CustomersService, SalesOrdersService],
})
export class SalesModule {}
