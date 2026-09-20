import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard.js";
import { PermissionsRepository } from "./permissions.repository.js";
import { PermissionsService } from "./permissions.service.js";

@Module({
  providers: [
    PermissionsRepository,
    PermissionsService,
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PermissionsService],
})
export class RolesPermissionsModule {}
