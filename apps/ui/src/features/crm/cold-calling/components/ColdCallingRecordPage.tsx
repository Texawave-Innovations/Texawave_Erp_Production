"use client";

import type { CrmColdCallingEntry } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { ArrowLeft, PhoneCall } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import { celebrateCrm } from "@/features/crm/celebration";
import { DetailPageBoxes } from "@/features/crm/legacy-ui/DetailPageBoxes";
import type { PanelSectionDef } from "@/features/crm/legacy-ui/RecordFormPanel";
import { useCreateColdCallingEntry, useUpdateColdCallingEntry } from "../hooks";

/** Flat string shape of the legacy `ColdCallingRow`. */
export interface ColdCallingValues {
  serialNo: string;
  date: string;
  companyName: string;
  prospectName: string;
  designation: string;
  status: string;
}

const SECTIONS: PanelSectionDef<ColdCallingValues>[] = [
  {
    id: "call",
    title: "Cold Calling Details",
    description:
      "Serial number, date and the original call outcome — exactly as logged.",
    icon: PhoneCall,
    tone: "amber",
    fields: [
      { key: "serialNo", label: "Serial No (SINO)" },
      { key: "date", label: "Date", type: "date" },
      { key: "status", label: "Status", type: "textarea", span: 2 },
    ],
  },
  {
    id: "company",
    title: "Company & Prospect",
    description: "Who was called.",
    icon: PhoneCall,
    tone: "blue",
    fields: [
      { key: "companyName", label: "Company Name", required: true },
      { key: "prospectName", label: "Prospect Name" },
      { key: "designation", label: "Designation" },
    ],
  },
];

const BACK_LABEL = "Back to Cold Calling Status";

function entryToValues(e: CrmColdCallingEntry | null): ColdCallingValues {
  return {
    serialNo: e?.serialNo ?? "",
    date: e?.callDate ? e.callDate.slice(0, 10) : "",
    companyName: e?.companyName ?? "",
    prospectName: e?.prospectName ?? "",
    designation: e?.designation ?? "",
    status: e?.status ?? "",
  };
}

/** Legacy ColdCallingStatus view-only / edit full-page forms. `entry === null`
 * with `mode="edit"` creates a new row. */
export function ColdCallingRecordPage({
  mode,
  entry,
  onClose,
}: {
  mode: "view" | "edit";
  entry: CrmColdCallingEntry | null;
  onClose: () => void;
}) {
  const [values, setValues] = useState<ColdCallingValues>(() =>
    entryToValues(entry),
  );
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateColdCallingEntry();
  const updateMutation = useUpdateColdCallingEntry();
  const saving = createMutation.isPending || updateMutation.isPending;

  async function save() {
    if (!values.companyName.trim()) {
      setError("Company Name is required");
      return;
    }
    setError(null);
    const update = Boolean(entry);
    const t = (v: string) => v.trim();
    const input = {
      serialNo: update ? t(values.serialNo) : t(values.serialNo) || undefined,
      callDate: t(values.date) || undefined,
      companyName: t(values.companyName),
      prospectName: update
        ? t(values.prospectName)
        : t(values.prospectName) || undefined,
      designation: update
        ? t(values.designation)
        : t(values.designation) || undefined,
      status: update ? values.status : values.status.trim() || undefined,
    };
    try {
      if (entry) {
        await updateMutation.mutateAsync({ id: entry.id, input });
      } else {
        await createMutation.mutateAsync(input);
        celebrateCrm("mining.recordCreated");
      }
      toast.success("Record saved");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save record");
    }
  }

  if (mode === "view") {
    return (
      <div className="space-y-6 pb-8">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={onClose}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {BACK_LABEL}
        </Button>
        <DetailPageBoxes<ColdCallingValues>
          heading={values.companyName || "Record Details"}
          subheading="Cold Calling Status — View Only"
          sections={SECTIONS}
          values={values}
          onFieldChange={() => undefined}
          onFieldBlur={() => undefined}
          readOnly
          emphasized
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={onClose}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {BACK_LABEL}
      </Button>
      <DetailPageBoxes<ColdCallingValues>
        heading={values.companyName || "New Record"}
        subheading="Cold Calling Status"
        sections={SECTIONS}
        values={values}
        onFieldChange={(field, value) =>
          setValues((prev) => ({ ...prev, [field]: value }))
        }
        onFieldBlur={() => undefined}
        emphasized
        footer={
          <>
            <div className="text-sm text-slate-600">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : (
                "Fill in the details and click Save & Close."
              )}
            </div>
            <div className="flex justify-end gap-2">
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
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save & Close"}
              </Button>
            </div>
          </>
        }
      />
    </div>
  );
}
