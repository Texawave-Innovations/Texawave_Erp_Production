import { Module } from "@nestjs/common";
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
  imports: [ScmProductsModule],
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
