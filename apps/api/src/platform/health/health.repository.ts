import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "../../shared/redis/redis.constants.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";

/** The only place `PrismaService`/the Redis client are called for health
 * purposes — mirrors the Controller → Service → Repository shape even for
 * this trivial case, so it stays a copyable reference (Docs/CODING_STANDARDS.md §3). */
@Injectable()
export class HealthRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async pingDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async pingRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}
