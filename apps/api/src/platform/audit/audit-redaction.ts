import type { Prisma } from "@texawave-erp/database";

/** A stored snapshot larger than this is rejected, not truncated — a truncated
 * audit record would silently lose exactly the detail someone later needs. */
export const MAX_SNAPSHOT_BYTES = 16 * 1024;
const MAX_DEPTH = 8;
const REDACTED = "[redacted]";

/** Whole words that mark a key as secret (after splitting camelCase/snake_case). */
const SECRET_WORDS = new Set([
  "otp",
  "secret",
  "secrets",
  "token",
  "tokens",
  "password",
  "passwd",
  "authorization",
  "refresh",
  "activation",
  "credential",
  "credentials",
  "apikey",
]);
/** Substrings that mark a key as secret even inside a longer word. */
const SECRET_FRAGMENTS = ["password", "passwd", "secret", "token", "apikey"];

export class AuditPayloadTooLargeError extends Error {
  constructor(bytes: number) {
    super(
      `Audit snapshot is ${bytes} bytes (limit ${MAX_SNAPSHOT_BYTES}) — audit an allow-listed subset of fields instead`,
    );
    this.name = "AuditPayloadTooLargeError";
  }
}

export function isSecretKey(key: string): boolean {
  // Separators removed, so `apiKey`, `api_key` and `api-key` all read "apikey".
  const compact = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (SECRET_FRAGMENTS.some((f) => compact.includes(f))) return true;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return words.some((w) => SECRET_WORDS.has(w));
}

function clean(value: unknown, depth: number): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") {
    if (typeof value === "function" || typeof value === "symbol") return null;
    return value as string | number | boolean;
  }
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) {
    return value.map((v) => clean(v, depth + 1)) as Prisma.InputJsonArray;
  }
  const out: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (inner === undefined) continue;
    // A secret's presence is worth recording; its value never is.
    out[key] = isSecretKey(key) ? REDACTED : clean(inner, depth + 1);
  }
  return out as Prisma.InputJsonObject;
}

/**
 * Prepares an entity snapshot for `audit_logs.before/after`: secret-looking
 * keys at ANY depth are replaced by "[redacted]", dates/bigints become
 * strings, and an oversized result throws. A deny-list is the second safety
 * net — the first is that each module snapshots an allow-listed set of fields
 * (never a raw row), so a newly added column is not logged until someone adds
 * it deliberately.
 */
export function toAuditSnapshot(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  const cleaned = clean(value, 0);
  if (cleaned === null) return undefined;
  const bytes = Buffer.byteLength(JSON.stringify(cleaned), "utf8");
  if (bytes > MAX_SNAPSHOT_BYTES) throw new AuditPayloadTooLargeError(bytes);
  return cleaned;
}
