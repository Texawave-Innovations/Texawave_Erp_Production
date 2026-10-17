"use client";

import type { CrmMiningRow } from "@texawave-erp/api-types";
import {
  Activity,
  ArrowLeft,
  Building2,
  Globe2,
  Hash,
  Sparkles,
  Target,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/legacy-ui/button";
import { DetailPageBoxes } from "@/features/crm/legacy-ui/DetailPageBoxes";
import type {
  PanelSectionDef,
  PanelTone,
} from "@/features/crm/legacy-ui/RecordFormPanel";
import { useCustomFields } from "@/features/crm/bulk-import/hooks";
import {
  MINING_SECTIONS,
  emptyMiningValues,
  miningValuesFromRow,
  type MiningFormValues,
} from "../sections";

export interface MiningRowPanelProps {
  /** Existing row to view/edit; omit to create a new one. */
  row?: CrmMiningRow | undefined;
  readOnly?: boolean | undefined;
  onBack: () => void;
  onSave: (
    values: MiningFormValues,
    customFields: Record<string, string>,
  ) => Promise<void>;
}

type PanelValues = MiningFormValues & { customFields: Record<string, string> };

const SECTION_STYLE: Record<
  string,
  { icon: PanelSectionDef<PanelValues>["icon"]; tone: PanelTone }
> = {
  basic: { icon: Hash, tone: "slate" },
  company: { icon: Building2, tone: "blue" },
  "decision-maker": { icon: UserCheck, tone: "purple" },
  "follow-up": { icon: Activity, tone: "amber" },
  "business-profile": { icon: Globe2, tone: "teal" },
  ownership: { icon: Target, tone: "rose" },
};

/** Legacy AccountsMiningSheet view / edit pages: `DetailPageBoxes` rendering
 * of the 6 sections (+ "Additional Fields (from Import)" once bulk import has
 * discovered any). Legacy autosaved per field; the API needs a company name up
 * front, so the whole record is saved with Save & Close. */
export function MiningRowPanel({
  row,
  readOnly = false,
  onBack,
  onSave,
}: MiningRowPanelProps) {
  const [values, setValues] = useState<PanelValues>(() => ({
    ...(row ? miningValuesFromRow(row) : emptyMiningValues()),
    customFields: { ...(row?.customFields ?? {}) },
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customDefs = useCustomFields("accountsMining").data ?? [];

  const sections = ((): PanelSectionDef<PanelValues>[] => {
    const built: PanelSectionDef<PanelValues>[] = MINING_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      icon: SECTION_STYLE[s.id]?.icon ?? Hash,
      tone: SECTION_STYLE[s.id]?.tone ?? "slate",
      fields: s.fields.map((f) => ({
        key: f.key,
        label: f.label,
        ...(f.type ? { type: f.type } : {}),
        ...(f.options ? { options: [...f.options] } : {}),
        ...(f.span ? { span: f.span } : {}),
        ...(f.required ? { required: true } : {}),
      })),
    }));
    // Keys present on this row but not (yet) in the module's field defs.
    const known = new Set(customDefs.map((d) => d.key));
    const defs = [
      ...customDefs.map((d) => ({ key: d.key, label: d.label })),
      ...Object.keys(values.customFields)
        .filter((k) => !known.has(k))
        .map((k) => ({ key: k, label: k })),
    ];
    if (defs.length === 0) return built;
    return [
      ...built,
      {
        id: "custom-fields",
        title: "Additional Fields (from Import)",
        description:
          "Discovered automatically from an imported Excel column with no matching built-in field.",
        icon: Sparkles,
        tone: "brand" as const,
        fields: defs.map((d) => ({
          custom: true as const,
          key: d.key,
          label: d.label,
        })),
      },
    ];
  })();

  async function handleSave() {
    if (!values.companyName.trim()) {
      setError("Name of the Company is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { customFields, ...rest } = values;
      await onSave(rest, customFields);
    } catch {
      setError("Could not save the record. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={onBack}
        disabled={saving}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Account Mining Sheet
      </Button>
      <DetailPageBoxes<PanelValues>
        heading={values.companyName || (row ? "Record Details" : "New Record")}
        subheading={`Accounts Mining Sheet${readOnly ? " — View Only" : ""}`}
        sections={sections}
        values={values}
        onFieldChange={(field, value) =>
          setValues((prev) => ({ ...prev, [field]: value }))
        }
        onFieldBlur={() => undefined}
        onSelectCommit={(field, value) =>
          setValues((prev) => ({ ...prev, [field]: value }))
        }
        onCustomFieldChange={(key, value) =>
          setValues((prev) => ({
            ...prev,
            customFields: { ...prev.customFields, [key]: value },
          }))
        }
        onCustomFieldBlur={() => undefined}
        readOnly={readOnly}
        emphasized
        footer={
          readOnly ? undefined : (
            <>
              <div className="text-sm text-slate-600">
                {error ? (
                  <span className="text-red-600">{error}</span>
                ) : (
                  "Fill in the details and click Save & Close."
                )}
              </div>
              <Button
                type="button"
                className="rounded-xl gap-1.5"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : "Save & Close"}
              </Button>
            </>
          )
        }
      />
    </div>
  );
}
