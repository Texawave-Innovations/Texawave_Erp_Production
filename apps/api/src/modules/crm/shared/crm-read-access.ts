const SCOPE_SUFFIXES = ["own", "team", "all"] as const;

/** True when the caller's resolved permission set grants read on an entity —
 * either the plain code (`crm.account.read`) or, for team-scoped entities, any
 * of its `.own` / `.team` / `.all` variants. The actual row filtering is still
 * done by the owning module's service (which resolves the scope itself), so
 * this only decides whether an entity type may be queried at all. */
export function holdsRead(
  granted: readonly string[],
  code: string,
  scoped = false,
): boolean {
  if (!scoped) return granted.includes(code);
  return SCOPE_SUFFIXES.some((s) => granted.includes(`${code}.${s}`));
}
