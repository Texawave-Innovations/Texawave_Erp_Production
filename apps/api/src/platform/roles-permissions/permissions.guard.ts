import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PERMISSION_KEY } from "../../common/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../auth/authenticated-user.js";
import { PermissionsService } from "./permissions.service.js";

/**
 * Checks the permission string set by `@RequirePermission()` against the
 * requesting user's resolved permission set (Docs/ARCHITECTURE.md §6 point
 * 4). Runs after `JwtAuthGuard` (Nest evaluates guards in the order they're
 * listed on `@UseGuards()` / the global guard list) — `request.user` is
 * required to be set already.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
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
    if (!granted.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}
