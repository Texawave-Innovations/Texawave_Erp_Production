import { HttpException, HttpStatus } from "@nestjs/common";

/** Base for business-rule violations a service enforces — never throw this
 * directly, throw a subclass. Nest's own built-in exceptions
 * (`UnauthorizedException`, `BadRequestException`, ...) are still fine for
 * framework-level rejections; `BusinessException` is specifically for domain
 * rules (Docs/CODING_STANDARDS.md §7). Uses `HttpException`'s own built-in
 * `errorCode` option (Nest 12+) rather than a hand-rolled field — it becomes
 * the response body's `error` field via `AllExceptionsFilter`, and
 * `exception.errorCode` is already typed `string | undefined` on the base
 * class, so subclasses don't need to redeclare it. */
export abstract class BusinessException extends HttpException {
  constructor(message: string, status: HttpStatus, errorCode: string) {
    super(message, status, { errorCode });
  }
}

export class ResourceNotFoundException extends BusinessException {
  constructor(resource: string, identifier: string | number) {
    super(
      `${resource} not found: ${identifier}`,
      HttpStatus.NOT_FOUND,
      "RESOURCE_NOT_FOUND",
    );
  }
}

export class ResourceConflictException extends BusinessException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT, "RESOURCE_CONFLICT");
  }
}

/** A request that is well-formed but breaks a business rule (422) — e.g. an
 * overlapping shift assignment, a date range that ends before it starts. Give
 * each rule its own stable `errorCode` so clients and tests can branch on it. */
export class BusinessRuleViolationException extends BusinessException {
  constructor(message: string, errorCode: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, errorCode);
  }
}

/** A state-machine move that is not allowed from the current state (422). */
export class InvalidStateTransitionException extends BusinessException {
  constructor(entity: string, from: string, to: string, detail?: string) {
    super(
      `${entity} cannot move from ${from} to ${to}${detail ? `: ${detail}` : ""}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      "INVALID_STATE_TRANSITION",
    );
  }
}

/** Optimistic-lock failure: the row changed since the client read it (409). */
export class VersionConflictException extends BusinessException {
  constructor(resource: string) {
    super(
      `${resource} was modified by someone else — reload and retry`,
      HttpStatus.CONFLICT,
      "VERSION_CONFLICT",
    );
  }
}

/** A conflict with existing data that is a domain rule, not a duplicate key
 * (409) — e.g. a shift assignment overlapping another. A stable `errorCode`
 * lets clients tell it apart from a plain `RESOURCE_CONFLICT`. */
export class BusinessRuleConflictException extends BusinessException {
  constructor(message: string, errorCode: string) {
    super(message, HttpStatus.CONFLICT, errorCode);
  }
}
