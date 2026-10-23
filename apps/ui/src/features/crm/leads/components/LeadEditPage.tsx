"use client";

import type { Lead } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import { celebrateCrm } from "@/features/crm/celebration";
import { useCustomFields } from "@/features/crm/bulk-import/hooks";
import { DetailPageBoxes } from "@/features/crm/legacy-ui/DetailPageBoxes";
import type { PanelSectionDef } from "@/features/crm/legacy-ui/RecordFormPanel";
import { useCreateLead, useUpdateLead } from "../hooks";
import {
  LEAD_FORM_SECTIONS,
  emptyLeadValues,
  leadToValues,
  validateLeadValues,
  valuesToInput,
  type LeadFormValues,
} from "../sections";

/** Legacy "edit row" page (DetailPageBoxes with the 7 lead sections). Legacy
 * autosaved each field to Firebase; the API needs company + prospect name up
 * front, so changes are held locally and committed with Save. */
export function LeadEditPage({
  lead,
  backLabel = "Back to Leads",
  onClose,
  onSaved,
}: {
  /** `null` = creating a new lead. */
  lead: Lead | null;
  backLabel?: string;
  onClose: () => void;
  onSaved?: (lead: Lead) => void;
}) {
  const [values, setValues] = useState<LeadFormValues>(() =>
    lead ? leadToValues(lead) : emptyLeadValues(),
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => ({ ...(lead?.customFields ?? {}) }),
  );
  const [error, setError] = useState<string | null>(null);
  const customDefs = useCustomFields("leads").data ?? [];
  const known = new Set(customDefs.map((d) => d.key));
  const customFieldDefs = [
    ...customDefs.map((d) => ({ key: d.key, label: d.label })),
    ...Object.keys(customValues)
      .filter((k) => !known.has(k))
      .map((k) => ({ key: k, label: k })),
  ];
  const sections: PanelSectionDef<LeadFormValues>[] =
    customFieldDefs.length === 0
      ? LEAD_FORM_SECTIONS
      : [
          ...LEAD_FORM_SECTIONS,
          {
            id: "custom-fields",
            title: "Additional Fields (from Import)",
            description:
              "Discovered automatically from an imported Excel column with no matching built-in field.",
            icon: Sparkles,
            tone: "brand",
            fields: customFieldDefs.map((d) => ({
              custom: true as const,
              key: d.key,
              label: d.label,
            })),
          },
        ];
  const panelValues = { ...values, customFields: customValues };
  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const saving = createMutation.isPending || updateMutation.isPending;

  async function save(andNew: boolean) {
    const problem = validateLeadValues(values);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      let saved: Lead;
      if (lead) {
        saved = await updateMutation.mutateAsync({
          id: lead.id,
          input: {
            ...valuesToInput(values, "update"),
            customFields: customValues,
          },
        });
        toast.success("Lead updated");
      } else {
        saved = await createMutation.mutateAsync({
          ...valuesToInput(values, "create"),
          customFields: customValues,
        });
        celebrateCrm("lead.created");
        toast.success("Lead created");
      }
      onSaved?.(saved);
      if (andNew) {
        setValues(emptyLeadValues());
        setCustomValues({});
      } else onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not save this lead. Check the fields and try again.",
      );
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={onClose}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Button>
      <DetailPageBoxes<LeadFormValues>
        heading={values.companyName || (lead ? "Lead" : "New Lead")}
        subheading="Leads"
        sections={sections}
        values={panelValues}
        onFieldChange={(field, value) =>
          setValues((prev) => ({ ...prev, [field]: value }))
        }
        onFieldBlur={() => undefined}
        onSelectCommit={(field, value) =>
          setValues((prev) => ({ ...prev, [field]: value }))
        }
        onCustomFieldChange={(key, value) =>
          setCustomValues((prev) => ({ ...prev, [key]: value }))
        }
        onCustomFieldBlur={() => undefined}
        emphasized
        footer={
          <>
            <div className="text-sm text-slate-600">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : (
                "Fill in the details and click Save."
              )}
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              {!lead && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  disabled={saving}
                  onClick={() => void save(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Save &amp; New
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={saving}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl gap-1.5"
                disabled={saving}
                onClick={() => void save(false)}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        }
      />
    </div>
  );
}
