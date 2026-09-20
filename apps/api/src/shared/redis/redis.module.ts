import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";
import { REDIS_CLIENT } from "./redis.constants.js";

/** Injectable infra provider (Docs/CODING_STANDARDS.md §3) — used for the
 * refresh-token store (platform/auth) and the resolved-permission-set cache
 * (platform/roles-permissions). */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>("REDIS_URL"), {
          lazyConnect: false,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
