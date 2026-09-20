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
