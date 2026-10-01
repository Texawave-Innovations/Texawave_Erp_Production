import { Module } from "@nestjs/common";
import { RolesPermissionsModule } from "../roles-permissions/roles-permissions.module.js";
import { UsersController } from "./users.controller.js";
import { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";

@Module({
  imports: [RolesPermissionsModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
