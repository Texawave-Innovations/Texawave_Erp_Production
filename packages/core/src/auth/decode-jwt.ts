/**
 * Decodes a JWT's payload WITHOUT verifying its signature. This is only
 * ever safe for reading claims for UI/display/cache-key purposes (e.g.
 * "which organization is this token for, so query keys can be scoped") —
 * every request is re-validated by the API regardless, so a forged token
 * decoded here can't grant access to anything. Never use this result to
 * make an authorization decision in the frontend.
 */
export function decodeJwtPayload<T>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = parts[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!payload) {
      return null;
    }
    const json =
      typeof atob === "function"
        ? atob(payload)
        : Buffer.from(payload, "base64").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
