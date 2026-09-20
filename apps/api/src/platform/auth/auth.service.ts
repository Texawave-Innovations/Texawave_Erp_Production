import { randomUUID } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "../../shared/redis/redis.constants.js";
import { OrganizationsRepository } from "../organizations/organizations.repository.js";
import { PermissionsService } from "../roles-permissions/permissions.service.js";
import { UsersRepository } from "../users/users.repository.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from "./jwt-payload.interface.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function refreshKey(userId: string, jti: string): string {
  return `refresh:${userId}:${jti}`;
}

/**
 * Deliberately minimal: login, refresh, logout only — no signup or password
 * reset (those are business-facing flows, out of scope for this
 * foundation). JWT payload carries `userId, organizationId, roleIds`
 * (Docs/ARCHITECTURE.md §6 point 1); refresh tokens live in Redis keyed
 * `refresh:{userId}:{jti}` for O(1) revocation on logout.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly organizations: OrganizationsRepository,
    private readonly users: UsersRepository,
    private readonly permissions: PermissionsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async login(
    organizationSlug: string,
    email: string,
    password: string,
  ): Promise<AuthTokens> {
    const organization = await this.organizations.findBySlug(organizationSlug);
    if (!organization) {
      throw new UnauthorizedException(
        "Invalid organization, email, or password",
      );
    }

    const user = await this.users.findByEmail(
      { organizationId: organization.id },
      email,
    );
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        "Invalid organization, email, or password",
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException(
        "Invalid organization, email, or password",
      );
    }

    // Login is the natural point to (re)prime the permission cache so the
    // first request after login isn't a cache-miss round trip.
    await this.permissions.invalidate(user.id);
    const roleIds = await this.permissions.getRoleIdsForUser(user.id);

    return this.issueTokens(user.id, organization.id, roleIds);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwt.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Not a refresh token");
    }

    const stillValid = await this.redis.get(
      refreshKey(payload.sub, payload.jti),
    );
    if (!stillValid) {
      throw new UnauthorizedException(
        "Refresh token has been revoked or expired",
      );
    }

    // Rotate: the old refresh token is single-use.
    await this.redis.del(refreshKey(payload.sub, payload.jti));

    const user = await this.users.findById(
      { organizationId: stillValid },
      payload.sub,
    );
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    const roleIds = await this.permissions.getRoleIdsForUser(user.id);
    return this.issueTokens(user.id, stillValid, roleIds);
  }

  async logout(userId: string): Promise<void> {
    const keys = await this.redis.keys(refreshKey(userId, "*"));
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    await this.permissions.invalidate(userId);
  }

  private async issueTokens(
    userId: string,
    organizationId: string,
    roleIds: string[],
  ): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      organizationId,
      roleIds,
      type: "access",
    };
    const accessToken = this.jwt.sign(accessPayload, {
      secret: this.config.getOrThrow<string>("JWT_SECRET"),
      expiresIn: this.config.getOrThrow<number>("JWT_ACCESS_TTL_SECONDS"),
    });

    const jti = randomUUID();
    const refreshTtl = this.config.getOrThrow<number>(
      "JWT_REFRESH_TTL_SECONDS",
    );
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      jti,
      type: "refresh",
    };
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: this.config.getOrThrow<string>("JWT_SECRET"),
      expiresIn: refreshTtl,
    });
    // The Redis TTL, not the JWT's own `exp`, is the actual revocation
    // mechanism (Docs/ARCHITECTURE.md §6 point 1) — the value is the
    // organizationId so `refresh()` doesn't need a second lookup for it.
    await this.redis.set(
      refreshKey(userId, jti),
      organizationId,
      "EX",
      refreshTtl,
    );

    return { accessToken, refreshToken };
  }
}
