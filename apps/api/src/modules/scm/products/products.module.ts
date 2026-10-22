import { Module } from "@nestjs/common";
import { ScmProductsController } from "./products.controller.js";
import { ScmProductsRepository } from "./products.repository.js";
import { ScmProductsService } from "./products.service.js";

@Module({
  controllers: [ScmProductsController],
  providers: [ScmProductsRepository, ScmProductsService],
  exports: [ScmProductsService],
})
export class ScmProductsModule {}
