import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../../common/exceptions/business.exception.js";

/** A system role (shipped by the platform) cannot be renamed or deactivated;
 * its permissions stay editable (422). */
export class SystemRoleProtectedException extends BusinessException {
  constructor(what: string) {
    super(
      `System roles cannot be ${what}. Clone the role to make a variant instead.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      "SYSTEM_ROLE_PROTECTED",
    );
  }
}

/** Deactivating a role that users still hold (409). */
export class RoleInUseException extends BusinessException {
  constructor(users: number) {
    super(
      `${users} user${users === 1 ? " still holds" : "s still hold"} this role. Move them to another role before deactivating it.`,
      HttpStatus.CONFLICT,
      "ROLE_IN_USE",
    );
  }
}

// The lock-out rule is shared with the users module, so it lives in the
// platform layer (platform/roles-permissions/role-admin-guard.ts).
export { AccessLockoutException } from "../../../platform/roles-permissions/role-admin-guard.js";
