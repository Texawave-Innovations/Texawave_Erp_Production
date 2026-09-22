import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { LoggerModule } from "./common/logger/logger.module.js";
import { ConfigModule } from "./config/config.module.js";
import { TagsModule } from "./modules/_reference/tags/tags.module.js";
import { RolesModule } from "./modules/settings/roles/roles.module.js";
import { AuthModule } from "./platform/auth/auth.module.js";
import { HealthModule } from "./platform/health/health.module.js";
import { RolesPermissionsModule } from "./platform/roles-permissions/roles-permissions.module.js";
import { TenancyModule } from "./platform/tenancy/tenancy.module.js";
import { PrismaModule } from "./shared/prisma/prisma.module.js";
import { RedisModule } from "./shared/redis/redis.module.js";

@Module({
  imports: [
    // Order matters for a few of these: ConfigModule first (everything else
    // reads env), LoggerModule early (its pino-http middleware needs to be
    // in place before requests are handled), then infra (Prisma/Redis),
    // then platform (auth/permissions/tenancy — auth depends on
    // Prisma/Redis), then business modules last.
    //
    // AuthModule (and RolesPermissionsModule, which it already imports)
    // must be listed before TenancyModule: Nest collects global APP_GUARD
    // providers in module-discovery order, and TenancyModule now also
    // imports RolesPermissionsModule (for TeamContextService,
    // Docs/CODING_STANDARDS.md §10a). If TenancyModule were discovered
    // first, PermissionsGuard would be registered before JwtAuthGuard,
    // running permission checks before authentication has even run.
    ConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    RolesPermissionsModule,
    TenancyModule,
    HealthModule,
    TagsModule,
    RolesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Registered here (not only via app.useGlobalPipes() in main.ts) so
    // Test.createTestingModule({ imports: [AppModule] }) gets the same
    // validation behavior main.ts's bootstrap() gets — no drift between
    // what runs in tests and what runs for real.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}
