import { Module } from "@nestjs/common";
import { RolesPermissionsModule } from "../../platform/roles-permissions/roles-permissions.module.js";
import { MenuController } from "./menu.controller.js";
import { MenuRepository } from "./menu.repository.js";
import { MenuService } from "./menu.service.js";

@Module({
  imports: [RolesPermissionsModule],
  controllers: [MenuController],
  providers: [MenuRepository, MenuService],
  exports: [MenuService, MenuRepository],
})
export class MenuModule {}
