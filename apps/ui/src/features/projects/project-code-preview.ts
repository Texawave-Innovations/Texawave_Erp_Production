import type { ProjectCodeMaster } from "@texawave-erp/api-types";

/** Indian financial year (April–March) label of a `YYYY-MM-DD` day, e.g.
 * 2026-05-10 -> `26-27`. Mirrors `financialYearLabel` in the API's
 * `sequences/project-sequences.ts`. */
function financialYearOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getUTCFullYear();
  const startYear = d.getUTCMonth() < 3 ? year - 1 : year;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

function clean(segment: string | null | undefined): string {
  return (segment ?? "").trim().replace(/\//g, "-").toUpperCase();
}

/**
 * What the project code will look like, e.g. `TW/PRJ/ME/26-27/###`, using the
 * same rules as the API (`[prefix]/[module]/[type]/[FY]/[sequence]`; the type
 * falls back to the code master's default, the FY to the start date's Indian
 * financial year). The sequence number is only allocated on save, so it is
 * shown as `#` placeholders. `master` is undefined when the code master
 * can't be read; the preview then uses the API's own defaults.
 */
export function projectCodePreview(
  master: ProjectCodeMaster | undefined,
  typeCode: string,
  startDate: string,
): string {
  const digits = Math.min(
    12,
    Math.max(1, Math.trunc(master?.sequenceDigits ?? 3) || 3),
  );
  const stem = [
    clean(master?.companyPrefix) || "TW",
    clean(master?.moduleIdentifier) || "PRJ",
    clean(typeCode) || clean(master?.defaultProjectCode),
    clean(master?.financialYear) || financialYearOf(startDate),
  ]
    .filter(Boolean)
    .join("/");
  return `${stem}/${"#".repeat(digits)}`;
}
