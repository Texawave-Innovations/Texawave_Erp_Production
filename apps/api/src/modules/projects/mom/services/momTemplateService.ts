// src/modules/projects/mom/services/momTemplateService.ts

import { ref, get, set, update, remove, push } from "firebase/database";
import { database } from "@/services/firebase";
import { MomTemplate, OFFICIAL_TEXAWAVE_MOM_TEMPLATE } from "../types/mom";

/**
 * Retrieves all MoM templates from Firebase.
 * Automatically seeds the official default TexaWave template if no templates exist.
 */
export async function getMomTemplates(): Promise<MomTemplate[]> {
  const templatesRef = ref(database, "mom_templates");
  const snap = await get(templatesRef);

  if (!snap.exists()) {
    try {
      await set(
        ref(database, `mom_templates/${OFFICIAL_TEXAWAVE_MOM_TEMPLATE.id}`),
        OFFICIAL_TEXAWAVE_MOM_TEMPLATE,
      );
      return [OFFICIAL_TEXAWAVE_MOM_TEMPLATE];
    } catch {
      return [OFFICIAL_TEXAWAVE_MOM_TEMPLATE];
    }
  }

  const data = snap.val();
  const list: MomTemplate[] = Object.entries(data).map(
    ([id, item]: [string, any]) => ({
      id,
      ...item,
      name: item.name || "Untitled Template",
      code: item.code || `MOM-TMPL-${id.slice(-4).toUpperCase()}`,
      version: item.version || "V1.0",
      version_number: item.version_number || 1,
      status: item.status || "active",
      sections: Array.isArray(item.sections) ? item.sections : [],
    }),
  );

  // Ensure official template exists
  if (
    !list.some(
      (t) =>
        t.id === OFFICIAL_TEXAWAVE_MOM_TEMPLATE.id ||
        t.code === OFFICIAL_TEXAWAVE_MOM_TEMPLATE.code,
    )
  ) {
    try {
      await set(
        ref(database, `mom_templates/${OFFICIAL_TEXAWAVE_MOM_TEMPLATE.id}`),
        OFFICIAL_TEXAWAVE_MOM_TEMPLATE,
      );
      list.unshift(OFFICIAL_TEXAWAVE_MOM_TEMPLATE);
    } catch {}
  }

  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list;
}

/**
 * Retrieves a single template by ID.
 */
export async function getMomTemplateById(
  id: string,
): Promise<MomTemplate | null> {
  const snap = await get(ref(database, `mom_templates/${id}`));
  if (!snap.exists()) {
    if (id === OFFICIAL_TEXAWAVE_MOM_TEMPLATE.id) {
      return OFFICIAL_TEXAWAVE_MOM_TEMPLATE;
    }
    return null;
  }
  return { id, ...snap.val() };
}

/**
 * Creates a new draft MoM template.
 */
export async function createMomTemplate(
  data: Partial<MomTemplate>,
  currentUser: any,
): Promise<MomTemplate> {
  const now = new Date().toISOString();
  const userId =
    currentUser?.id || currentUser?.uid || currentUser?.username || "user";
  const newRef = push(ref(database, "mom_templates"));
  const id = newRef.key!;

  const newTemplate: MomTemplate = {
    id,
    name: (data.name || "New Meeting Template").trim(),
    code: (data.code || `MOM-${id.slice(-4).toUpperCase()}`)
      .trim()
      .toUpperCase(),
    description: (data.description || "").trim(),
    category: (data.category || "General Operations").trim(),
    version: "V1.0",
    version_number: 1,
    status: "draft",
    isDefault: false,
    sections:
      data.sections ||
      JSON.parse(JSON.stringify(OFFICIAL_TEXAWAVE_MOM_TEMPLATE.sections)),
    defaultAgenda:
      data.defaultAgenda ||
      JSON.parse(JSON.stringify(OFFICIAL_TEXAWAVE_MOM_TEMPLATE.defaultAgenda)),
    defaultNoteRows:
      data.defaultNoteRows ||
      JSON.parse(
        JSON.stringify(OFFICIAL_TEXAWAVE_MOM_TEMPLATE.defaultNoteRows),
      ),
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
  };

  await set(newRef, newTemplate);
  return newTemplate;
}

/**
 * Duplicates an existing template as a draft copy.
 */
export async function duplicateMomTemplate(
  template: MomTemplate,
  currentUser: any,
): Promise<MomTemplate> {
  const now = new Date().toISOString();
  const userId =
    currentUser?.id || currentUser?.uid || currentUser?.username || "user";
  const newRef = push(ref(database, "mom_templates"));
  const id = newRef.key!;

  const cloned: MomTemplate = {
    ...template,
    id,
    name: `${template.name} (Copy)`,
    code: `${template.code}-COPY`,
    version: "V1.0",
    version_number: 1,
    parent_version_id: template.id,
    status: "draft",
    isDefault: false,
    createdAt: now,
    createdBy: userId,
    publishedAt: undefined,
    updatedAt: now,
  };

  await set(newRef, cloned);
  return cloned;
}

/**
 * Creates a new version (e.g. V2.0) of a published template in 'draft' status.
 * Leaves the published template unchanged and immutable.
 */
export async function createNewTemplateVersion(
  template: MomTemplate,
  currentUser: any,
): Promise<MomTemplate> {
  const now = new Date().toISOString();
  const userId =
    currentUser?.id || currentUser?.uid || currentUser?.username || "user";
  const nextVerNumber = (template.version_number || 1) + 1;
  const nextVersion = `V${nextVerNumber}.0`;

  const newRef = push(ref(database, "mom_templates"));
  const id = newRef.key!;

  const newVersionDoc: MomTemplate = {
    ...template,
    id,
    version: nextVersion,
    version_number: nextVerNumber,
    parent_version_id: template.id,
    status: "draft",
    isDefault: false,
    createdAt: now,
    createdBy: userId,
    publishedAt: undefined,
    updatedAt: now,
  };

  await set(newRef, newVersionDoc);
  return newVersionDoc;
}

/**
 * Publishes a draft template, making it active and locking its version.
 */
export async function publishMomTemplate(id: string): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `mom_templates/${id}`), {
    status: "active",
    publishedAt: now,
    updatedAt: now,
  });
}

/**
 * Updates a draft template's content and sections.
 */
export async function updateDraftTemplate(
  id: string,
  payload: Partial<MomTemplate>,
): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `mom_templates/${id}`), {
    ...payload,
    updatedAt: now,
  });
}

/**
 * Archives a template. Archived templates cannot be selected for new documents,
 * but existing documents referencing them remain fully resolvable and intact.
 */
export async function archiveMomTemplate(id: string): Promise<void> {
  const now = new Date().toISOString();
  await update(ref(database, `mom_templates/${id}`), {
    status: "archived",
    updatedAt: now,
  });
}

/**
 * Deletes a draft template.
 */
export async function deleteMomTemplate(id: string): Promise<void> {
  await remove(ref(database, `mom_templates/${id}`));
}
