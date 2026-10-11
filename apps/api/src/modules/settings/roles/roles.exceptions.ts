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

/** A change that would leave nobody — or the caller — able to manage roles
 * (409). Prevents locking the organization out of its own access control. */
export class AccessLockoutException extends BusinessException {
  constructor(reason: "nobody" | "self") {
    super(
      reason === "nobody"
        ? "This change would leave nobody able to manage roles. Keep “Manage roles” on at least one role that an active user holds."
        : "This change would remove “Manage roles” from you. Ask another administrator to make it.",
      HttpStatus.CONFLICT,
      "ACCESS_LOCKOUT",
    );
  }
}
