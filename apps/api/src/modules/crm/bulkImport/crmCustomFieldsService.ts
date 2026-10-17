// CRM Bulk Import — dynamic custom fields. When an imported Excel column has no matching built-in
// CRM field for its module, Bulk Import auto-creates one here instead of dropping the column. The
// definition persists (so a second import of the same header reuses it instead of creating a
// duplicate) and every affected tab renders/edits it using the exact same UI components as its
// built-in fields — see DetailPageBoxes.tsx's `CustomPanelFieldDef` branch, and each tab's own
// "Custom Fields" section/columns.
import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { database } from "@/services/firebase";
import { createInCollection } from "../domain/firebaseCollection";

/** One custom-fields "bucket" per CRM module — a field belongs only to its own module, never
 *  created globally. `accounts` is shared by Call Back-Send Info, Not Interested, Keep in Touch and
 *  Interested, since those 4 tabs are filtered views over the same underlying Account records. */
export type CrmCustomFieldModule =
  "leads" | "accountsMining" | "accounts" | "meetings" | "coldCalling";

export interface CrmCustomFieldDef {
  id: string;
  /** Generated, storage-safe key — e.g. `sourceMarketRegion` from a "Source / Market Region" header. */
  key: string;
  label: string;
  module: CrmCustomFieldModule;
  /** The exact Excel header text this field was created from, kept for traceability. */
  sourceHeader: string;
  createdBy: string;
  createdAt: number;
}

const CUSTOM_FIELDS_PATH = "crm/customFieldDefs";

/** Same normalization Bulk Import's own header matching uses (case/whitespace-insensitive) — a
 *  field is only ever (re)created when no built-in field AND no existing custom field already
 *  normalizes to the same thing. */
export function normalizeFieldLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

/** Converts a raw Excel header into a stable, storage-safe camelCase field key — Firebase Realtime
 *  Database keys can't contain `. # $ [ ] /`, so this also strips anything outside `[a-zA-Z0-9]`. */
function slugifyHeaderToKey(header: string): string {
  const words = header
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return `field${Date.now()}`;
  const [first, ...rest] = words;
  const key =
    first.toLowerCase() +
    rest.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
  // A field key colliding with a JS/Firebase reserved-ish word ("length", "id", ...) is astronomically
  // unlikely from a real spreadsheet header, but cheap to guard against outright.
  return key || `field${Date.now()}`;
}

export function useCrmCustomFields(
  module: CrmCustomFieldModule,
): CrmCustomFieldDef[] {
  const [defs, setDefs] = useState<CrmCustomFieldDef[]>([]);
  useEffect(() => {
    const unsub = onValue(
      ref(database, `${CUSTOM_FIELDS_PATH}/${module}`),
      (snap) => {
        const val = (snap.val() || {}) as Record<
          string,
          Omit<CrmCustomFieldDef, "id">
        >;
        setDefs(Object.entries(val).map(([id, def]) => ({ id, ...def })));
      },
    );
    return () => unsub();
  }, [module]);
  return defs;
}

/** Finds an existing custom field for `module` whose label normalizes the same as `header`, without
 *  subscribing — used by the Bulk Import auto-creation flow, which needs a one-shot, up-to-date
 *  answer right before deciding whether to create a new field. */
export async function findCrmCustomField(
  module: CrmCustomFieldModule,
  header: string,
): Promise<CrmCustomFieldDef | undefined> {
  return new Promise((resolve) => {
    onValue(
      ref(database, `${CUSTOM_FIELDS_PATH}/${module}`),
      (snap) => {
        const val = (snap.val() || {}) as Record<
          string,
          Omit<CrmCustomFieldDef, "id">
        >;
        const target = normalizeFieldLabel(header);
        const match = Object.entries(val).find(
          ([, def]) => normalizeFieldLabel(def.label) === target,
        );
        resolve(match ? { id: match[0], ...match[1] } : undefined);
      },
      { onlyOnce: true },
    );
  });
}

/** Result of resolving one unmatched Excel header for a module — either a genuine custom field
 *  (found or newly created), or a signal that the header actually belongs to an existing built-in
 *  field whose key just happens to equal this header's generated slug (see `resolvedToBaseField`
 *  on `getOrCreateCrmCustomField` below). */
export interface CrmCustomFieldResolution {
  /** True when no custom field was created/reused — `key` is an existing BUILT-IN field's key for
   *  this module, and the header should be mapped straight to it instead. */
  resolvedToBaseField: boolean;
  key: string;
  /** Only set when `resolvedToBaseField` is false — the found-or-created custom field. */
  def?: CrmCustomFieldDef;
}

/** Resolves a genuinely unmatched Excel header to either an existing/new custom field, or an
 *  existing BUILT-IN field for `module` — idempotent both ways: a repeat import of the same header
 *  reuses whichever it resolved to last time, never creating a duplicate custom field, and never
 *  creating one at all when a base field already owns that key.
 *
 *  `baseFieldKeys` guards exactly that: a header's generated key can coincidentally equal an
 *  existing built-in field's key even though the header's label/aliases didn't match it (e.g.
 *  Leads' "Prospect Name" header vs. its built-in `prospectName` field, labeled "Prospect / Lead
 *  Name") — without this check, a custom field would be created under the very same key the
 *  built-in field already uses, and `splitCustomFields` (crmBulkImportSheets.ts) would then divert
 *  the imported value into `customFields.prospectName` instead of the real top-level field, leaving
 *  it blank. Generic by construction: every module passes its own current base field keys, so this
 *  protects Leads, Accounts Mining, Accounts, Meetings and Cold Calling Status alike. */
export async function getOrCreateCrmCustomField(
  module: CrmCustomFieldModule,
  header: string,
  createdBy: string,
  baseFieldKeys: string[],
): Promise<CrmCustomFieldResolution> {
  const label = header.trim();
  const key = slugifyHeaderToKey(label);
  if (baseFieldKeys.includes(key)) {
    return { resolvedToBaseField: true, key };
  }

  const existing = await findCrmCustomField(module, header);
  if (existing)
    return { resolvedToBaseField: false, key: existing.key, def: existing };

  const def: Omit<CrmCustomFieldDef, "id"> = {
    key,
    label,
    module,
    sourceHeader: header,
    createdBy,
    createdAt: Date.now(),
  };
  const id = await createInCollection<CrmCustomFieldDef>(
    `${CUSTOM_FIELDS_PATH}/${module}`,
    def,
  );
  return { resolvedToBaseField: false, key, def: { id, ...def } };
}

/** Writes one custom-field value onto an existing record — the shared helper every tab's
 *  `onCustomFieldChange`/blur wiring calls instead of hand-rolling the same path string. */
export async function setCrmCustomFieldValue(
  recordPath: string,
  recordId: string,
  fieldKey: string,
  value: string,
): Promise<void> {
  await set(
    ref(database, `${recordPath}/${recordId}/customFields/${fieldKey}`),
    value,
  );
}
