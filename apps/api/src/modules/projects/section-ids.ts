/**
 * Template section lists (`MomTemplate.sectionsJson`,
 * `ProposalTemplate.schemaJson`) are free-form JSON columns, so nothing in the
 * database or DTO validation stops a section from having a missing or
 * duplicate `id`. The UIs key React lists and store per-section values by that
 * id, so a duplicate renders the wrong rows and makes sections share content.
 *
 * Every template write goes through this so bad ids can never be stored. The
 * first occurrence keeps its id (existing documents keep resolving); later
 * duplicates and blanks get a deterministic suffix. Nested `children`
 * (proposal section groups) share the same id space.
 */
export function ensureUniqueSectionIds<T>(sections: T[]): T[] {
  const seen = new Set<string>();
  const walk = (list: unknown[], prefix: string): unknown[] =>
    list.map((raw, index) => {
      if (!raw || typeof raw !== "object") return raw;
      const section = raw as Record<string, unknown>;
      const given =
        typeof section.id === "string" || typeof section.id === "number"
          ? String(section.id).trim()
          : "";
      const base = given || `${prefix}${index + 1}`;
      let id = base;
      for (let n = 2; seen.has(id); n++) id = `${base}_${n}`;
      seen.add(id);
      return {
        ...section,
        id,
        ...(Array.isArray(section.children)
          ? { children: walk(section.children, `${id}_c`) }
          : {}),
      };
    });
  return walk(sections, "sec_") as T[];
}
