import { randomBytes, randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { ThrottlerException } from "@nestjs/throttler";
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "../../shared/redis/redis.constants.js";
import { OrganizationsRepository } from "../organizations/organizations.repository.js";
import { PermissionsService } from "../roles-permissions/permissions.service.js";
import { UsersRepository } from "../users/users.repository.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from "./jwt-payload.interface.js";
import { MailerService } from "./mailer.service.js";
import { PasswordResetTokensRepository } from "./password-reset-tokens.repository.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function refreshKey(userId: number, jti: string): string {
  return `refresh:${userId}:${jti}`;
}

/**
 * Login, refresh, logout, forgot-password — no signup yet (a separate,
 * still out-of-scope business-facing flow). JWT payload carries
 * `userId, organizationId, roleIds` (Docs/ARCHITECTURE.md §6 point 1);
 * refresh tokens live in Redis keyed `refresh:{userId}:{jti}` for O(1)
 * revocation on logout. Password-reset tokens live in Postgres
 * (`PasswordResetToken`), not Redis — they need to survive past a single
 * TTL-bound lookup and be queryable by hash from the reset-confirm step.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly organizations: OrganizationsRepository,
    private readonly users: UsersRepository,
    private readonly permissions: PermissionsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    private readonly passwordResetTokens: PasswordResetTokensRepository,
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

  /**
   * Always resolves the same way regardless of whether the org/email/user
   * exists — the caller (controller) always returns the same 200 response
   * no matter what happens in here. Never let a caught error, an early
   * return, or a timing difference leak whether an account exists
   * (user-enumeration).
   */
  async forgotPassword(organizationSlug: string, email: string): Promise<void> {
    // Per-email limit, on top of the per-IP one on the route
    // (@Throttle on AuthController.forgotPassword). Applied before any
    // existence check and with the same threshold for every email string —
    // a nonexistent email trips it exactly like a real one, so it can't be
    // used to probe which emails exist.
    const attemptsKey = `password-reset-attempts:${email.toLowerCase()}`;
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, 15 * 60);
    }
    if (attempts > 3) {
      throw new ThrottlerException(
        "Too many password reset requests for this email. Try again later.",
      );
    }

    const organization = await this.organizations.findBySlug(organizationSlug);
    const user = organization
      ? await this.users.findByEmail({ organizationId: organization.id }, email)
      : null;

    if (!user || !user.isActive) {
      return;
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const ttlMinutes = this.config.getOrThrow<number>(
      "PASSWORD_RESET_TOKEN_TTL_MINUTES",
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    await this.passwordResetTokens.create(user.id, tokenHash, expiresAt);

    const baseUrl = this.config.getOrThrow<string>("APP_BASE_URL");
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    await this.mailer.sendPasswordResetEmail(user.email, resetUrl);
  }

  /**
   * Never reveals *why* a token failed (invalid / expired / already used) —
   * always the same generic error, logged server-side only (Docs' auth
   * story non-negotiable). On success: kills every other active session by
   * revoking all of the user's refresh tokens, same as `logout()`.
   *
   * No `$transaction` here — this codebase has no existing transaction
   * pattern (see Docs/CODING_STANDARDS.md), and introducing one is a
   * deliberate architectural decision, not something to fold into this
   * feature. Instead the two writes are ordered so the unsafe half of the
   * failure window is avoided: the token is marked used *before* the
   * password is updated. If the process dies in between, the worst case is
   * a wasted token (self-healing — the user just requests a new one), never
   * a reusable token or a silently-failed password change.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const now = new Date();
    const candidates = await this.passwordResetTokens.findValidCandidates(now);

    let match: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
        match = candidate;
        break;
      }
    }

    if (!match) {
      this.logger.warn("Password reset failed: no matching valid token");
      throw new UnauthorizedException("Invalid or expired reset link");
    }
    if (!match.user.isActive) {
      this.logger.warn(
        `Password reset failed: user ${match.userId} is inactive`,
      );
      throw new UnauthorizedException("Invalid or expired reset link");
    }

    await this.passwordResetTokens.markUsed(match.id, now);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.updatePasswordHash(
      { organizationId: match.user.organizationId },
      match.userId,
      passwordHash,
    );

    await this.revokeAllRefreshTokens(match.userId);
    await this.permissions.invalidate(match.userId);
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

    // Redis always returns stored values as strings — the organizationId
    // was stored as a number (issueTokens below) and must be parsed back.
    const organizationId = Number(stillValid);
    const user = await this.users.findById({ organizationId }, payload.sub);
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    const roleIds = await this.permissions.getRoleIdsForUser(user.id);
    return this.issueTokens(user.id, organizationId, roleIds);
  }

  async logout(userId: number): Promise<void> {
    await this.revokeAllRefreshTokens(userId);
    await this.permissions.invalidate(userId);
  }

  /** Shared by `logout()` and `resetPassword()` — both need to kill every
   * active session for a user. */
  private async revokeAllRefreshTokens(userId: number): Promise<void> {
    const keys = await this.redis.keys(refreshKey(userId, "*"));
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getMe(
    userId: number,
    organizationId: number,
  ): Promise<{
    userId: number;
    organizationId: number;
    email: string;
    fullName: string;
    roleIds: number[];
    permissions: string[];
  }> {
    const user = await this.users.findById({ organizationId }, userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const [roleIds, permissions] = await Promise.all([
      this.permissions.getRoleIdsForUser(userId),
      this.permissions.getPermissionsForUser(userId),
    ]);

    return {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      fullName: user.fullName,
      roleIds,
      permissions,
    };
  }

  private async issueTokens(
    userId: number,
    organizationId: number,
    roleIds: number[],
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
