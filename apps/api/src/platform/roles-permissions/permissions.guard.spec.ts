import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  PERMISSION_KEY,
  SCOPED_PERMISSION_KEY,
} from "../../common/decorators/require-permission.decorator.js";
import { PermissionsGuard } from "./permissions.guard.js";

interface Meta {
  exact?: string;
  scoped?: string;
}

function makeGuard(meta: Meta, granted: string[], user: object | undefined) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) =>
      key === PERMISSION_KEY
        ? meta.exact
        : key === SCOPED_PERMISSION_KEY
          ? meta.scoped
          : undefined,
    ),
  };
  const permissions = {
    getPermissionsForUser: vi.fn().mockResolvedValue(granted),
  };
  const guard = new PermissionsGuard(
    reflector as unknown as Reflector,
    permissions as never,
  );
  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard, context, permissions };
}

const USER = { userId: 7, organizationId: 1, roleIds: [1] };

describe("PermissionsGuard", () => {
  describe("no permission metadata", () => {
    it("lets the request through without loading permissions", async () => {
      const { guard, context, permissions } = makeGuard({}, [], USER);
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(permissions.getPermissionsForUser).not.toHaveBeenCalled();
    });
  });

  describe("@RequirePermission (exact string)", () => {
    it("allows a caller holding the exact permission", async () => {
      const { guard, context } = makeGuard(
        { exact: "settings.role.write" },
        ["settings.role.write"],
        USER,
      );
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it("denies a caller holding only a different permission", async () => {
      const { guard, context } = makeGuard(
        { exact: "settings.role.write" },
        ["settings.role.read"],
        USER,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("does NOT treat a scope variant as a match for a different exact scope", async () => {
      const { guard, context } = makeGuard(
        { exact: "hr.employee.read.team" },
        ["hr.employee.read.all"],
        USER,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("denies when there is no authenticated user", async () => {
      const { guard, context } = makeGuard(
        { exact: "settings.role.write" },
        [],
        undefined,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe("@RequireScopedPermission (any of .own/.team/.all)", () => {
    it.each(["own", "team", "all"])(
      "allows a caller holding only the .%s variant",
      async (level) => {
        const { guard, context } = makeGuard(
          { scoped: "hr.employee.read" },
          [`hr.employee.read.${level}`],
          USER,
        );
        await expect(guard.canActivate(context)).resolves.toBe(true);
      },
    );

    it("allows a caller holding several variants", async () => {
      const { guard, context } = makeGuard(
        { scoped: "hr.employee.read" },
        ["hr.employee.read.own", "hr.employee.read.all"],
        USER,
      );
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it.each([
      ["no permissions at all", []],
      ["the bare prefix without a scope", ["hr.employee.read"]],
      ["a different action's scoped variant", ["hr.employee.write.all"]],
      ["a different entity's scoped variant", ["hr.leave.read.all"]],
      ["a non-scope suffix", ["hr.employee.read.everyone"]],
      ["a longer action sharing the prefix", ["hr.employee.readx.all"]],
      ["the prefix nested one level deeper", ["hr.employee.read.team.extra"]],
    ])("denies a caller holding %s", async (_label, granted) => {
      const { guard, context } = makeGuard(
        { scoped: "hr.employee.read" },
        granted,
        USER,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("denies when there is no authenticated user", async () => {
      const { guard, context } = makeGuard(
        { scoped: "hr.employee.read" },
        ["hr.employee.read.all"],
        undefined,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe("both kinds of metadata on one route", () => {
    it("requires both to be satisfied", async () => {
      const meta = {
        exact: "hr.employee.approve.all",
        scoped: "hr.employee.read",
      };

      const both = makeGuard(
        meta,
        ["hr.employee.approve.all", "hr.employee.read.own"],
        USER,
      );
      await expect(both.guard.canActivate(both.context)).resolves.toBe(true);

      const onlyExact = makeGuard(meta, ["hr.employee.approve.all"], USER);
      await expect(
        onlyExact.guard.canActivate(onlyExact.context),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const onlyScoped = makeGuard(meta, ["hr.employee.read.all"], USER);
      await expect(
        onlyScoped.guard.canActivate(onlyScoped.context),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
