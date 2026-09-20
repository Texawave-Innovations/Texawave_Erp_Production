import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ClsModule } from "nestjs-cls";
import { TenancyInterceptor } from "./tenancy.interceptor.js";
import { TenantContextService } from "./tenant-context.service.js";

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
  ],
  providers: [
    TenantContextService,
    { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor },
  ],
  exports: [TenantContextService],
})
export class TenancyModule {}
