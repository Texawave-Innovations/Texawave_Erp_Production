// Defect master and QC templates.
import { createRecord, getAllRecords, updateRecord } from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { QUALITY_PATHS } from "./qualityPaths";
import type {
  ScmQualityCheckpoint,
  ScmQualityDefect,
  ScmQualityDefectCategory,
  ScmQualityDefectSeverity,
  ScmQualityInspectionType,
  ScmQualityTemplate,
} from "@/types";

export interface CreateDefectInput {
  defectCode: string;
  name: string;
  description?: string;
  category: ScmQualityDefectCategory;
  severity: ScmQualityDefectSeverity;
}

export async function createDefect(
  input: CreateDefectInput,
  performedBy: string,
): Promise<string> {
  const code = input.defectCode.trim().toUpperCase();
  if (!code) throw new Error("Defect code is required.");
  if (!input.name.trim()) throw new Error("Defect name is required.");
  const existing = (await getAllRecords(
    QUALITY_PATHS.defects,
  )) as ScmQualityDefect[];
  if (existing.some((d) => d.defectCode.toUpperCase() === code))
    throw new Error(`Defect code ${code} already exists.`);
  const id = await createRecord(QUALITY_PATHS.defects, {
    defectCode: code,
    name: input.name.trim(),
    description: input.description,
    category: input.category,
    severity: input.severity,
    active: true,
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<ScmQualityDefect, "id">);
  if (!id) throw new Error("Failed to create defect.");
  await logRecordAudit(
    QUALITY_PATHS.defects,
    id,
    "Defect added",
    performedBy,
    `${code} — ${input.name.trim()} (${input.severity})`,
  );
  return id;
}

export async function updateDefect(
  defect: ScmQualityDefect,
  patch: Partial<
    Pick<ScmQualityDefect, "name" | "description" | "category" | "severity">
  >,
  performedBy: string,
): Promise<void> {
  await updateRecord(QUALITY_PATHS.defects, defect.id, patch);
  await logRecordAudit(
    QUALITY_PATHS.defects,
    defect.id,
    "Defect updated",
    performedBy,
    defect.defectCode,
  );
}

/** Defects are never hard-deleted — only deactivated, so historical inspections keep a valid reference. */
export async function setDefectActive(
  defect: ScmQualityDefect,
  active: boolean,
  performedBy: string,
): Promise<void> {
  await updateRecord(QUALITY_PATHS.defects, defect.id, { active });
  await logRecordAudit(
    QUALITY_PATHS.defects,
    defect.id,
    active ? "Defect activated" : "Defect deactivated",
    performedBy,
    defect.defectCode,
  );
}

export interface CreateTemplateInput {
  templateCode: string;
  name: string;
  description?: string;
  inspectionType: ScmQualityInspectionType;
  checkpoints: Array<Omit<ScmQualityCheckpoint, "checkpointId">>;
}

export async function createTemplate(
  input: CreateTemplateInput,
  performedBy: string,
): Promise<string> {
  const code = input.templateCode.trim().toUpperCase();
  if (!code) throw new Error("Template code is required.");
  if (!input.name.trim()) throw new Error("Template name is required.");
  if (!input.checkpoints || input.checkpoints.length === 0)
    throw new Error("Add at least one checkpoint.");
  const existing = (await getAllRecords(
    QUALITY_PATHS.templates,
  )) as ScmQualityTemplate[];
  if (existing.some((t) => t.templateCode.toUpperCase() === code))
    throw new Error(`Template code ${code} already exists.`);
  const checkpoints: ScmQualityCheckpoint[] = input.checkpoints.map(
    (c, idx) => ({
      ...c,
      checkpointId: `cp_${Date.now().toString(36)}_${idx}`,
      sequence: c.sequence ?? idx + 1,
    }),
  );
  const id = await createRecord(QUALITY_PATHS.templates, {
    templateCode: code,
    name: input.name.trim(),
    description: input.description,
    inspectionType: input.inspectionType,
    active: true,
    checkpoints,
    createdBy: performedBy,
    createdAt: Date.now(),
  } satisfies Omit<ScmQualityTemplate, "id">);
  if (!id) throw new Error("Failed to create template.");
  await logRecordAudit(
    QUALITY_PATHS.templates,
    id,
    "Template created",
    performedBy,
    `${code} — ${input.name.trim()}`,
  );
  return id;
}

export async function updateTemplate(
  template: ScmQualityTemplate,
  patch: Partial<
    Pick<ScmQualityTemplate, "name" | "description" | "checkpoints">
  >,
  performedBy: string,
): Promise<void> {
  await updateRecord(QUALITY_PATHS.templates, template.id, patch);
  await logRecordAudit(
    QUALITY_PATHS.templates,
    template.id,
    "Template updated",
    performedBy,
    template.templateCode,
  );
}

export async function setTemplateActive(
  template: ScmQualityTemplate,
  active: boolean,
  performedBy: string,
): Promise<void> {
  await updateRecord(QUALITY_PATHS.templates, template.id, { active });
  await logRecordAudit(
    QUALITY_PATHS.templates,
    template.id,
    active ? "Template activated" : "Template deactivated",
    performedBy,
    template.templateCode,
  );
}
