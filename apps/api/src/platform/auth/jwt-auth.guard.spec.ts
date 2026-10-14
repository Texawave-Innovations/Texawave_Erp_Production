import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator.js";
import type { AuthenticatedUser } from "./authenticated-user.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { JwtStrategy } from "./jwt.strategy.js";

const SECRET = "unit-test-secret-at-least-32-characters-long";

// Constructing the strategy registers "jwt" with passport, so the guard's
// super.canActivate() runs the real passport-jwt verification (in-process,
// no network) against the plain request object below.
new JwtStrategy({ getOrThrow: () => SECRET } as never);

const jwt = new JwtService();

function accessToken(overrides: Record<string, unknown> = {}, secret = SECRET) {
  return jwt.sign(
    { sub: 7, organizationId: 1, roleIds: [3], type: "access", ...overrides },
    { secret, expiresIn: 900 },
  );
}

function makeGuard(isPublic: boolean | undefined, authorization?: string) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(isPublic) };
  const guard = new JwtAuthGuard(reflector as unknown as Reflector);
  const request: {
    headers: Record<string, string>;
    user?: AuthenticatedUser;
  } = { headers: authorization ? { authorization } : {} };
  const handler = () => undefined;
  class Controller {}
  const context = {
    getHandler: () => handler,
    getClass: () => Controller,
    getType: () => "http",
    getArgs: () => [request, {}],
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
  return { guard, reflector, request, context, handler, Controller };
}

describe("JwtAuthGuard", () => {
  it("lets @Public() routes through without a token and checks handler then class metadata", async () => {
    const { guard, reflector, context, handler, Controller, request } =
      makeGuard(true);

    // Returns synchronously — passport is never invoked.
    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      Controller,
    ]);
    expect(request.user).toBeUndefined();
  });

  it("rejects a non-public request with no Authorization header", async () => {
    const { guard, context } = makeGuard(undefined);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("treats public=false the same as no metadata", async () => {
    const { guard, context } = makeGuard(false);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("accepts a valid bearer access token and populates request.user", async () => {
    const { guard, context, request } = makeGuard(
      undefined,
      `Bearer ${accessToken()}`,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      userId: 7,
      organizationId: 1,
      roleIds: [3],
    });
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = accessToken({}, "attacker-controlled-secret-0123456789abc");
    const { guard, context, request } = makeGuard(
      undefined,
      `Bearer ${forged}`,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it("rejects an expired access token", async () => {
    const expired = jwt.sign(
      {
        sub: 7,
        organizationId: 1,
        roleIds: [3],
        type: "access",
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      { secret: SECRET },
    );
    const { guard, context } = makeGuard(undefined, `Bearer ${expired}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a validly-signed refresh token presented as a bearer token", async () => {
    const refresh = jwt.sign(
      { sub: 7, jti: "abc", type: "refresh" },
      { secret: SECRET, expiresIn: 900 },
    );
    const { guard, context, request } = makeGuard(
      undefined,
      `Bearer ${refresh}`,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it("rejects a tampered token (payload modified after signing)", async () => {
    const [header, , signature] = accessToken().split(".");
    const evilPayload = Buffer.from(
      JSON.stringify({
        sub: 1,
        organizationId: 1,
        roleIds: [1],
        type: "access",
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    ).toString("base64url");
    const { guard, context } = makeGuard(
      undefined,
      `Bearer ${header}.${evilPayload}.${signature}`,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a token sent without the Bearer scheme", async () => {
    const { guard, context } = makeGuard(undefined, accessToken());
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects an unsigned (alg=none) token", async () => {
    const enc = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${enc({ alg: "none", typ: "JWT" })}.${enc({
      sub: 7,
      organizationId: 1,
      roleIds: [1],
      type: "access",
      exp: Math.floor(Date.now() / 1000) + 900,
    })}.`;
    const { guard, context } = makeGuard(undefined, `Bearer ${none}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
