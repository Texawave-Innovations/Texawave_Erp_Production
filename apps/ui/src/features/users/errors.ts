import { ApiError, resolveMessage } from "@texawave-erp/core";

/**
 * The reason to show under a failed user action's toast. Business refusals
 * (e.g. ACCESS_LOCKOUT: the change would leave nobody, or you, able to
 * manage roles) carry a message written for people, so it is shown as is.
 */
export function userErrorDescription(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    if (error.isPermissionError)
      return resolveMessage("users.permissionDenied").title;
    if (error.errorCode) return error.message;
  }
  return undefined;
}
