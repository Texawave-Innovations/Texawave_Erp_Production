import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "../../shared/redis/redis.constants.js";
import { PermissionsRepository } from "./permissions.repository.js";

const CACHE_TTL_SECONDS = 15 * 60;

function cacheKey(userId: number): string {
  return `permissions:${userId}`;
}

/**
 * Resolved permission set, cached in Redis (Docs/ARCHITECTURE.md §6 point
 * 4) — computed once at login and reused by `PermissionsGuard` on every
 * subsequent request instead of re-joining role_permissions each time.
 * Invalidate on role/permission changes via `invalidate()`.
 */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly repository: PermissionsRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getPermissionsForUser(userId: number): Promise<string[]> {
    const cached = await this.redis.get(cacheKey(userId));
    if (cached) {
      return JSON.parse(cached) as string[];
    }
    const codes = await this.repository.findPermissionCodesForUser(userId);
    await this.redis.set(
      cacheKey(userId),
      JSON.stringify(codes),
      "EX",
      CACHE_TTL_SECONDS,
    );
    return codes;
  }

  async invalidate(userId: number): Promise<void> {
    await this.redis.del(cacheKey(userId));
  }

  /** Not cached — role IDs are only read at login/refresh to stamp the JWT,
   * not on every request (every request instead re-checks the cached
   * PERMISSION set, see `getPermissionsForUser`). */
  getRoleIdsForUser(userId: number): Promise<number[]> {
    return this.repository.findRoleIdsForUser(userId);
  }
}
