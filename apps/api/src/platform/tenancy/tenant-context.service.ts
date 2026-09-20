import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import type { OrgScope } from "../../common/tenancy/org-scope.js";

/**
 * Real, injectable platform capability (Docs/CODING_STANDARDS.md §3) backed
 * by `nestjs-cls`'s AsyncLocalStorage context. Populated by
 * `TenancyInterceptor` from the authenticated request; services read it and
 * pass the scope explicitly to repositories (never the other way — a
 * repository reading this itself would make it untestable outside a
 * request). Throws outside a request context or before authentication has
 * run — that's a caller bug (e.g. calling this from a public route), not a
 * business error.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  getOrgScope(): OrgScope {
    const organizationId = this.cls.get<string>("organizationId");
    if (!organizationId) {
      throw new Error(
        "TenantContextService.getOrgScope() called with no organization in context — " +
          "this route is either public or missing an auth guard.",
      );
    }
    return { organizationId };
  }

  getUserId(): string {
    const userId = this.cls.get<string>("userId");
    if (!userId) {
      throw new Error(
        "TenantContextService.getUserId() called with no user in context.",
      );
    }
    return userId;
  }

  getRoleIds(): string[] {
    return this.cls.get<string[]>("roleIds") ?? [];
  }

  getCorrelationId(): string | undefined {
    return this.cls.get<string>("correlationId");
  }
}
