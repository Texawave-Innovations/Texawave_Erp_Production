import { isIP } from "node:net";

/** Brings an address to one canonical form so `::ffff:115.96.5.24` (what a
 * dual-stack socket reports for an IPv4 client) matches `115.96.5.24`. */
export function normalizeIp(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const mapped = trimmed.startsWith("::ffff:") ? trimmed.slice(7) : null;
  return mapped !== null && isIP(mapped) === 4 ? mapped : trimmed;
}

/** True only for an exact match against an allowlisted address. A missing
 * client address is never on the office network (fail closed). */
export function isOnOfficeNetwork(
  clientIp: string | null | undefined,
  officeIps: readonly string[],
): boolean {
  if (!clientIp) return false;
  const client = normalizeIp(clientIp);
  return officeIps.some((office) => normalizeIp(office) === client);
}
