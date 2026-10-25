import type { Prisma } from "@texawave-erp/database";

/**
 * Project / task code generation — legacy `ProjectForm.tsx`
 * `generateFormattedProjectCode` and `utils/projectCalculations.ts`
 * `generateTaskRunningCode`:
 *
 *   project: `[Company Prefix]/[Module Id]/[Project Type]/[FY]/[Seq]`
 *            e.g. `TW/PRJ/ME/26-27/001`
 *   task:    `[Project Code][Separator][Task Prefix][Seq]`
 *            e.g. `TW/PRJ/ME/26-27/001-T01`
 *
 * The format settings come from the existing Projects Master tables
 * (`ProjectCodeMaster`, `TaskRunningNumberMaster`); allocation uses the
 * shared row-locked `platform.document_sequences` counter. Like legacy, the
 * project sequence is one continuous counter across project types and years
 * (the year/type are labels in the code, not counter resets), and task
 * numbers run per project. Codes already issued (`PRJ-000001`, `TSK-…`) are
 * left untouched.
 */

export interface ProjectCodeFormat {
  companyPrefix: string;
  moduleIdentifier: string;
  /** Project type / category code (e.g. `ME`); omitted from the code when empty. */
  typeCode: string | null;
  /** Financial-year label, e.g. `26-27`. */
  financialYear: string;
  sequenceDigits: number;
}

export interface TaskCodeFormat {
  taskPrefix: string;
  separator: string;
  sequenceDigits: number;
}

export const PROJECT_CODE_DOC_TYPE = "project_code";

function clean(segment: string | null | undefined): string {
  return (segment ?? "").trim().replace(/\//g, "-").toUpperCase();
}

function clampDigits(digits: number): number {
  return Math.min(12, Math.max(1, Math.trunc(digits) || 3));
}

/** Indian financial year (April–March) label of `date`, e.g. 2026-05-10 ->
 * `26-27`, 2027-02-01 -> `26-27` (legacy `getFYString`). */
export function financialYearLabel(date: Date): string {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() < 3 ? year - 1 : year;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

/** Everything before the sequence number: `TW/PRJ/ME/26-27/`. */
export function projectCodeStem(format: ProjectCodeFormat): string {
  return (
    [
      clean(format.companyPrefix) || "TW",
      clean(format.moduleIdentifier) || "PRJ",
      clean(format.typeCode),
      clean(format.financialYear),
    ]
      .filter(Boolean)
      .join("/") + "/"
  );
}

export function formatProjectCode(
  format: ProjectCodeFormat,
  sequence: number,
): string {
  return `${projectCodeStem(format)}${String(sequence).padStart(clampDigits(format.sequenceDigits), "0")}`;
}

export function formatTaskCode(
  projectCode: string,
  format: TaskCodeFormat,
  sequence: number,
): string {
  const separator = format.separator ?? "-";
  const prefix = (format.taskPrefix ?? "T").trim();
  return `${projectCode}${separator}${prefix}${String(sequence).padStart(clampDigits(format.sequenceDigits), "0")}`;
}

/** Locks and increments one `document_sequences` row, creating it first at
 * `seed` if missing (and never handing out a number below `seed`). */
async function nextNumber(
  tx: Prisma.TransactionClient,
  organizationId: number,
  docType: string,
  prefix: string,
  padding: number,
  seed: number,
): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    VALUES (${organizationId}, ${docType}, ${prefix}, ${padding}, ${seed}, now())
    ON CONFLICT (organization_id, doc_type) DO NOTHING`;

  const rows = await tx.$queryRaw<Array<{ issued: number }>>`
    UPDATE platform.document_sequences
       SET next_number = GREATEST(next_number, ${seed}) + 1, updated_at = now()
     WHERE organization_id = ${organizationId}
       AND doc_type = ${docType}
       AND deleted_at IS NULL
     RETURNING next_number - 1 AS issued`;

  const row = rows[0];
  if (!row) {
    throw new Error(
      `No active ${docType} sequence for organization ${organizationId}`,
    );
  }
  return Number(row.issued);
}

/** Issues the next project code under a row lock. The continuous counter is
 * seeded from the number of projects the organization already has, so the
 * first formatted code continues the legacy running number. */
export async function issueProjectCode(
  tx: Prisma.TransactionClient,
  organizationId: number,
  format: ProjectCodeFormat,
): Promise<string> {
  const existing = await tx.project.count({ where: { organizationId } });
  const issued = await nextNumber(
    tx,
    organizationId,
    PROJECT_CODE_DOC_TYPE,
    `${clean(format.companyPrefix) || "TW"}/${clean(format.moduleIdentifier) || "PRJ"}/`,
    clampDigits(format.sequenceDigits),
    existing + 1,
  );
  return formatProjectCode(format, issued);
}

/** Issues the next task code for one project (`<projectCode>-T01`, ...),
 * with a per-project counter seeded from the project's existing tasks. */
export async function issueTaskCode(
  tx: Prisma.TransactionClient,
  organizationId: number,
  project: { id: number; projectCode: string },
  format: TaskCodeFormat,
): Promise<string> {
  const existing = await tx.projectTask.count({
    where: { organizationId, projectId: project.id },
  });
  const issued = await nextNumber(
    tx,
    organizationId,
    `project_task:${project.id}`,
    `${project.projectCode}${format.separator ?? "-"}${(format.taskPrefix ?? "T").trim() || "T"}`,
    clampDigits(format.sequenceDigits),
    existing + 1,
  );
  return formatTaskCode(project.projectCode, format, issued);
}
