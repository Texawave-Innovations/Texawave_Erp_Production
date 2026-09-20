import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthenticatedUser } from "./authenticated-user.js";
import type { AccessTokenPayload } from "./jwt-payload.interface.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  // Passport calls this once the signature/expiry are already verified —
  // it only needs to shape what lands on `request.user`.
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Not an access token");
    }
    return {
      userId: payload.sub,
      organizationId: payload.organizationId,
      roleIds: payload.roleIds,
    };
  }
}
