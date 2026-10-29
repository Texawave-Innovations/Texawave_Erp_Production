import { Module } from "@nestjs/common";
import { ScmMasterListItemsModule } from "../master-list-items/master-list-items.module.js";
import { SuppliersController } from "./suppliers.controller.js";
import { SuppliersRepository } from "./suppliers.repository.js";
import { SuppliersService } from "./suppliers.service.js";

@Module({
  imports: [ScmMasterListItemsModule],
  controllers: [SuppliersController],
  providers: [SuppliersRepository, SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
