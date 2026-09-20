import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { RolesPermissionsModule } from "../roles-permissions/roles-permissions.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { JwtStrategy } from "./jwt.strategy.js";

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}), // secret/expiry passed explicitly per sign()/verify() call in AuthService
    OrganizationsModule,
    UsersModule,
    RolesPermissionsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Global: every route requires a valid access token unless @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
