/** The minimum a repository method needs to stay tenant-safe. Deliberately a
 * plain interface with no behavior — see CODING_STANDARDS.md §10 for why
 * `@OrgScoped()` does not inject this rather than requiring it as an explicit
 * parameter. */
export interface OrgScope {
  organizationId: string;
}
