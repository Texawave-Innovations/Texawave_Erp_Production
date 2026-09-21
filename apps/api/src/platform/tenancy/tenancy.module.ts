import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ClsModule } from "nestjs-cls";
import { RolesPermissionsModule } from "../roles-permissions/roles-permissions.module.js";
import { TeamContextService } from "./team-context.service.js";
import { TenancyInterceptor } from "./tenancy.interceptor.js";
import { TenantContextService } from "./tenant-context.service.js";

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    RolesPermissionsModule,
  ],
  providers: [
    TenantContextService,
    TeamContextService,
    { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor },
  ],
  exports: [TenantContextService, TeamContextService],
})
export class TenancyModule {}
