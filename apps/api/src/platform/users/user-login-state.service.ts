import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../tenancy/tenant-context.service.js";
import { UsersRepository } from "./users.repository.js";

/**
 * Narrow, purpose-built export for other modules (Docs/CODING_STANDARDS.md
 * §11) — "a caller cannot reasonably proceed without" the answer to exactly
 * one question: has this login already changed its temporary password. Not
 * `UsersService` wholesale, which also exposes CRUD, role, and team
 * assignment that no other module should reach into.
 */
@Injectable()
export class UserLoginStateService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** For the AUTHENTICATED user — resolved from the JWT's user id, never
   * from anything the client sends. */
  async currentUserMustChangePassword(): Promise<boolean> {
    const userId = this.tenantContext.getUserId();
    const user = await this.repository.findById(
      this.tenantContext.getOrgScope(),
      userId,
    );
    if (!user) throw new ResourceNotFoundException("User", userId);
    return user.mustChangePassword;
  }
}
