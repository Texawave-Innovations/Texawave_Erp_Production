import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AccessTokenPayload } from "./jwt-payload.interface.js";
import { JwtStrategy } from "./jwt.strategy.js";

const SECRET = "unit-test-secret-at-least-32-characters-long";

function makeStrategy() {
  const config = { getOrThrow: vi.fn().mockReturnValue(SECRET) };
  const strategy = new JwtStrategy(config as never);
  return { strategy, config };
}

describe("JwtStrategy", () => {
  it("reads the signing secret with getOrThrow (fails closed when unset)", () => {
    const { config } = makeStrategy();
    expect(config.getOrThrow).toHaveBeenCalledWith("JWT_SECRET");

    const missing = {
      getOrThrow: vi.fn(() => {
        throw new Error("JWT_SECRET missing");
      }),
    };
    expect(() => new JwtStrategy(missing as never)).toThrow(
      "JWT_SECRET missing",
    );
  });

  it("maps an access-token payload onto request.user", () => {
    const { strategy } = makeStrategy();
    const payload: AccessTokenPayload = {
      sub: 7,
      organizationId: 1,
      roleIds: [3, 4],
      type: "access",
    };
    expect(strategy.validate(payload)).toEqual({
      userId: 7,
      organizationId: 1,
      roleIds: [3, 4],
    });
  });

  it("only copies the expected claims (no extra payload fields leak onto request.user)", () => {
    const { strategy } = makeStrategy();
    const payload = {
      sub: 7,
      organizationId: 1,
      roleIds: [3],
      type: "access",
      isAdmin: true,
      iat: 1,
      exp: 2,
    } as unknown as AccessTokenPayload;
    expect(Object.keys(strategy.validate(payload)).sort()).toEqual([
      "organizationId",
      "roleIds",
      "userId",
    ]);
  });

  it("rejects a refresh token used as a bearer access token", () => {
    const { strategy } = makeStrategy();
    const refreshPayload = {
      sub: 7,
      jti: "abc",
      type: "refresh",
    } as unknown as AccessTokenPayload;
    expect(() => strategy.validate(refreshPayload)).toThrow(
      new UnauthorizedException("Not an access token"),
    );
  });

  it("rejects a payload with no type claim", () => {
    const { strategy } = makeStrategy();
    const untyped = {
      sub: 7,
      organizationId: 1,
      roleIds: [],
    } as unknown as AccessTokenPayload;
    expect(() => strategy.validate(untyped)).toThrow(UnauthorizedException);
  });
});
