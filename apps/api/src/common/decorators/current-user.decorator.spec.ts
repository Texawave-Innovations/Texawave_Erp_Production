import "reflect-metadata";
import type { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../platform/auth/authenticated-user.js";
import { CurrentUser } from "./current-user.decorator.js";

type Factory = (data: unknown, ctx: ExecutionContext) => unknown;

function getFactory(): Factory {
  class Probe {
    handler(@CurrentUser() _user: AuthenticatedUser) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, "handler") as
    Record<string, { factory: Factory }> | undefined;
  const entry = Object.values(args ?? {})[0];
  if (!entry) throw new Error("param decorator registered no metadata");
  return entry.factory;
}

const ctxWith = (request: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe("@CurrentUser()", () => {
  it("returns request.user as attached by the auth guard", () => {
    const user: AuthenticatedUser = {
      userId: 42,
      organizationId: 1,
      roleIds: [3, 4],
    };
    expect(getFactory()(undefined, ctxWith({ user }))).toBe(user);
  });

  it("returns undefined on an unauthenticated request", () => {
    expect(getFactory()(undefined, ctxWith({}))).toBeUndefined();
  });
});
