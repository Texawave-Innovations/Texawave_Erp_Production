// "Export Data" dialog — lets the user pick a format (Excel / PDF / Document) and, when the tab
// has an active search/filter, whether to export All records or only the Current View.
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, FileText, File as FileIcon } from "lucide-react";
import { toast } from "sonner";
import { FieldSchema } from "./types";
import { exportRecordsToExcel } from "./excelIO";
import { exportRecordsToPDF, exportRecordsToWord } from "./documentExport";

export type ExportFormat = "xlsx" | "pdf" | "docx";

export interface ExportDataDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleLabel: string;
  fields: FieldSchema<T>[];
  allRecords: T[];
  filteredRecords?: T[];
  fileBaseName: string;
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

export function ExportDataDialog<T>({
  open,
  onOpenChange,
  moduleLabel,
  fields,
  allRecords,
  filteredRecords,
  fileBaseName,
}: ExportDataDialogProps<T>) {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const showScopeChoice =
    !!filteredRecords && filteredRecords.length !== allRecords.length;
  const [scope, setScope] = useState<"all" | "filtered">("all");

  const handleExport = () => {
    const records =
      scope === "filtered" && filteredRecords ? filteredRecords : allRecords;
    if (records.length === 0) {
      toast.error("No records to export.");
      return;
    }
    if (format === "xlsx")
      exportRecordsToExcel(records, fields, moduleLabel, fileBaseName);
    else if (format === "pdf")
      exportRecordsToPDF(records, fields, moduleLabel, fileBaseName);
    else exportRecordsToWord(records, fields, moduleLabel, fileBaseName);
    toast.success(
      `Exported ${records.length} record${records.length === 1 ? "" : "s"} as ${FORMAT_OPTIONS.find((f) => f.value === format)?.label}`,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {showScopeChoice && (
            <div>
              <Label className="text-xs font-bold text-slate-600 mb-2 block">
                Records to include
              </Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as "all" | "filtered")}
                className="gap-2"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="all" /> All records (
                  {allRecords.length})
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="filtered" /> Current view / filtered (
                  {filteredRecords!.length})
                </label>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="rounded-xl gap-1.5" onClick={handleExport}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
