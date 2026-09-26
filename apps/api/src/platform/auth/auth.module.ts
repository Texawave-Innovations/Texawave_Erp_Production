import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule } from "@nestjs/throttler";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { RolesPermissionsModule } from "../roles-permissions/roles-permissions.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { MailerService } from "./mailer.service.js";
import { PasswordResetTokensRepository } from "./password-reset-tokens.repository.js";

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}), // secret/expiry passed explicitly per sign()/verify() call in AuthService
    OrganizationsModule,
    UsersModule,
    RolesPermissionsModule,
    // Scoped to forgot-password only (@UseGuards(ThrottlerGuard) on that one
    // route) — not registered as a global APP_GUARD, so login/refresh/logout
    // are untouched. Per-IP; per-email limiting is a separate Redis check in
    // AuthService itself, since this package only tracks by request IP.
    ThrottlerModule.forRoot([
      { name: "forgot-password", ttl: 15 * 60 * 1000, limit: 20 },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    MailerService,
    PasswordResetTokensRepository,
    // Global: every route requires a valid access token unless @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
