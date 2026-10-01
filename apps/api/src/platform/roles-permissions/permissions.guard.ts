import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import {
  PERMISSION_KEY,
  SCOPED_PERMISSION_KEY,
} from "../../common/decorators/require-permission.decorator.js";
import { TEAM_ACCESS_LEVELS } from "../../common/tenancy/team-scope.js";
import type { AuthenticatedUser } from "../auth/authenticated-user.js";
import { PermissionsService } from "./permissions.service.js";

/**
 * Checks the permission set by `@RequirePermission()` (exact string) and/or
 * `@RequireScopedPermission()` (any of `<prefix>.own|team|all`) against the
 * requesting user's resolved permission set (Docs/ARCHITECTURE.md §6 point
 * 4). Runs after `JwtAuthGuard` (Nest evaluates guards in the order they're
 * listed on `@UseGuards()` / the global guard list) — `request.user` is
 * required to be set already.
 *
 * If a route carries BOTH kinds of metadata, both must be satisfied — the
 * guard only ever adds requirements, never lets one requirement excuse
 * another. A route with neither is not permission-checked here (it is still
 * behind `JwtAuthGuard` unless marked `@Public()`).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const exact = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      targets,
    );
    const scopedPrefix = this.reflector.getAllAndOverride<string | undefined>(
      SCOPED_PERMISSION_KEY,
      targets,
    );
    if (!exact && !scopedPrefix) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new ForbiddenException(
        "No authenticated user for a permission-checked route",
      );
    }

    const granted = await this.permissions.getPermissionsForUser(
      request.user.userId,
    );
    if (exact && !granted.includes(exact)) {
      throw new ForbiddenException(`Missing permission: ${exact}`);
    }
    if (
      scopedPrefix &&
      !TEAM_ACCESS_LEVELS.some((level) =>
        granted.includes(`${scopedPrefix}.${level}`),
      )
    ) {
      throw new ForbiddenException(
        `Missing permission: ${scopedPrefix}.own, ${scopedPrefix}.team or ${scopedPrefix}.all`,
      );
    }
    return true;
  }
}
