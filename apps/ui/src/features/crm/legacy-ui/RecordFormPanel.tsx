// Shared field/section config types for the 8 CRM sheet modules (Accounts Mining Sheet, Leads,
// Yet to Happen, Call Back-Send Info, Keep in Touch, Not Interested, WhatsApp, LinkedIn).
// The tabbed-panel component these were originally written for was replaced by
// `DetailPageBoxes.tsx`'s full-page box rendering and is no longer used anywhere — only these
// type definitions survive, since AccountsMiningSheet.tsx/Leads.tsx/DetailPageBoxes.tsx still
// build their section config against this same shape.
import type { LucideIcon } from "lucide-react";

export type PanelFieldType = "text" | "textarea" | "select" | "date";

export interface PanelFieldDef<T> {
  key: keyof T;
  label: string;
  type?: PanelFieldType;
  options?: string[];
  span?: 2;
  /** Purely a visual hint (asterisk + red outline while empty) — the sheet still autosaves
   *  per-field, so this never blocks typing or saving. */
  required?: boolean;
  placeholder?: string;
  /** Discriminant against `CustomPanelFieldDef` below — always absent/false for a built-in field. */
  custom?: false;
}

export type PanelTone =
  "brand" | "blue" | "purple" | "amber" | "teal" | "rose" | "slate";

/** A field discovered by CRM Bulk Import from an Excel column with no matching built-in field
 *  (see `../bulkImport/crmCustomFieldsService.ts`). Its `key` is a runtime-generated string, so —
 *  unlike `PanelFieldDef<T>.key` — it can't be typed as `keyof T`; `DetailPageBoxes` reads/writes
 *  it against `values.customFields[key]` instead of `values[key]`, via the `onCustomFieldChange`/
 *  `onCustomFieldBlur` callbacks. */
export interface CustomPanelFieldDef {
  custom: true;
  key: string;
  label: string;
  type?: PanelFieldType;
  options?: string[];
  span?: 2;
}

export interface PanelSectionDef<T> {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: PanelTone;
  fields: (PanelFieldDef<T> | CustomPanelFieldDef)[];
}
