"use client";

import type { CrmExportEntity } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { Button } from "@/components/legacy-ui/button";
import { Checkbox } from "@/components/legacy-ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
import { Label } from "@/components/legacy-ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/legacy-ui/radio-group";
import {
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { exportEntity } from "../api";
import { exportToExcel, exportToPdf, exportToWord } from "../excel";

export type ExportFormat = "xlsx" | "pdf" | "docx";

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  entity: CrmExportEntity;
  moduleLabel: string;
  fileBaseName: string;
  /** The list's active search; enables the "current view" scope. */
  search?: string | undefined;
  hasCustomFields: boolean;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  description: string;
  icon: typeof FileSpreadsheet;
}[] = [
  {
    value: "xlsx",
    label: "Excel (.xlsx)",
    description:
      "Standard spreadsheet — best for re-importing or further analysis.",
    icon: FileSpreadsheet,
  },
  {
    value: "pdf",
    label: "PDF (.pdf)",
    description: "Read-only table document — best for sharing or printing.",
    icon: FileText,
  },
  {
    value: "docx",
    label: "Document (.doc)",
    description: "Opens in Word as an editable table document.",
    icon: FileIcon,
  },
];

/** Legacy ExportDataDialog: Excel / PDF / Document and All records vs the
 * Current view (server-side export, same contract as before). */
export function ExportDialog({
  open,
  onClose,
  entity,
  moduleLabel,
  fileBaseName,
  search,
  hasCustomFields,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [scope, setScope] = useState<"all" | "view">("all");
  const [includeCustom, setIncludeCustom] = useState(true);
  const [busy, setBusy] = useState(false);
  const hasView = Boolean(search?.trim());

  async function run() {
    setBusy(true);
    try {
      const result = await exportEntity(entity, {
        ...(scope === "view" && search ? { search } : {}),
        includeCustomFields: includeCustom,
      });
      if (result.rows.length === 0) {
        toast.error("No records to export.");
        return;
      }
      if (format === "xlsx")
        await exportToExcel(result, moduleLabel, fileBaseName);
      else if (format === "pdf")
        await exportToPdf(result, moduleLabel, fileBaseName);
      else exportToWord(result, moduleLabel, fileBaseName);
      toast.success(
        `Exported ${result.rows.length} record${result.rows.length === 1 ? "" : "s"} as ${FORMAT_OPTIONS.find((f) => f.value === format)?.label}${result.truncated ? ` (first ${result.rows.length} of ${result.total})` : ""}`,
      );
      onClose();
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Export failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data — {moduleLabel}</DialogTitle>
          <DialogDescription>
            Choose a format and how much data to export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-bold text-slate-600 mb-2 block">
              Format
            </Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              className="gap-2"
            >
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 has-[[data-state=checked]]:border-brand-400 has-[[data-state=checked]]:bg-brand-50/50"
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {opt.label}
                      </p>
                      <p className="text-sm text-slate-500">
                        {opt.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {hasView && (
            <div>
              <Label className="text-xs font-bold text-slate-600 mb-2 block">
                Records to include
              </Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as "all" | "view")}
                className="gap-2"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="all" /> All records
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="view" /> Current view / filtered
                  (search: {search})
                </label>
              </RadioGroup>
            </div>
          )}

          {hasCustomFields && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={includeCustom}
                onCheckedChange={(v) => setIncludeCustom(v === true)}
              />
              Include custom field columns
            </label>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl gap-1.5"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
