import { Module } from "@nestjs/common";
import { RolesPermissionsModule } from "../../../platform/roles-permissions/roles-permissions.module.js";
import { RolesController } from "./roles.controller.js";
import { RolesRepository } from "./roles.repository.js";
import { RolesService } from "./roles.service.js";

@Module({
  imports: [RolesPermissionsModule],
  controllers: [RolesController],
  providers: [RolesRepository, RolesService],
})
export class RolesModule {}
