import type { ApiErrorBody } from "@texawave-erp/api-types";

/**
 * One normalized error shape for every failure mode — a non-2xx response, a
 * network failure, or a response that isn't even valid JSON — so call sites
 * never need to know which kind they're handling (Docs/CODING_STANDARDS.md
 * "Frontend API/state/error standard").
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly correlationId: string | undefined;
  readonly fieldErrors: string[];

  constructor(body: ApiErrorBody) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    super(message);
    this.name = "ApiError";
    this.statusCode = body.statusCode;
    this.errorCode = body.error;
    this.correlationId = body.correlationId;
    this.fieldErrors = Array.isArray(body.message) ? body.message : [];
  }

  get isAuthError(): boolean {
    return this.statusCode === 401;
  }

  get isPermissionError(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isValidationError(): boolean {
    return this.statusCode === 400 && this.fieldErrors.length > 0;
  }

  static networkError(cause: unknown): ApiError {
    return new ApiError({
      statusCode: 0,
      message:
        "Could not reach the server — check your connection and try again.",
      error: "NETWORK_ERROR",
      path: "",
      timestamp: new Date().toISOString(),
    }).withCause(cause);
  }

  private withCause(cause: unknown): this {
    this.cause = cause;
    return this;
  }
}
