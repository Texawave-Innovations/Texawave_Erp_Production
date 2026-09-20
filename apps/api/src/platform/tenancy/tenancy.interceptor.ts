import { randomUUID } from "node:crypto";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { ClsService } from "nestjs-cls";
import type { Observable } from "rxjs";
import type { AuthenticatedUser } from "../auth/authenticated-user.js";

/**
 * Populates the CLS context for this request (Docs/ARCHITECTURE.md §6 point
 * 2). Runs globally, AFTER guards (so `request.user` is set by
 * `JwtAuthGuard` when the route is protected) and after all middleware (so
 * `request.id`, set by pino-http, is already available) — both guaranteed
 * by Nest's request lifecycle regardless of which middleware mounted first.
 * On a public route `request.user` is undefined; org/user context is simply
 * not populated (`TenantContextService` throws if something tries to read
 * it there, which is the correct failure mode).
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { id?: string; user?: AuthenticatedUser }>();

    this.cls.set("correlationId", request.id ?? randomUUID());

    if (request.user) {
      this.cls.set("organizationId", request.user.organizationId);
      this.cls.set("userId", request.user.userId);
      this.cls.set("roleIds", request.user.roleIds);
    }

    return next.handle();
  }
}
