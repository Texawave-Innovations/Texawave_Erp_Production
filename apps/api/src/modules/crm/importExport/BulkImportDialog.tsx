// Generic Bulk Import dialog used by every CRM data tab: Upload -> Map Headers -> Preview &
// Validate -> Confirm -> Result. Tabs only supply a FieldSchema[], optional duplicate-detection
// config, and a `commitImport` function that writes the validated rows to Firebase.
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DuplicateConfig,
  DuplicateStrategy,
  FieldSchema,
  HeaderMapping,
  ImportSummary,
  MappedImportRow,
  ParsedWorkbook,
} from "./types";
import {
  parseWorkbookFile,
  downloadErrorReport,
  downloadImportTemplate,
} from "./excelIO";
import { autoMatchHeaders, buildMappedRows } from "./fieldMatch";

type Step = "upload" | "mapping" | "preview" | "importing" | "result";

export interface BulkImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldSchema<T>[];
  duplicate?: DuplicateConfig;
  /** Receives only the rows the user chose to proceed with (valid, strategy already applied to
   *  which duplicates are included) and must create/update them, returning a summary. */
  commitImport: (
    rows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => Promise<ImportSummary>;
  fileBaseName: string;
  /** Optional limitation/scope note shown on the upload step (e.g. "line items are not imported"). */
  helperNote?: string;
  /** When provided, skips the Upload step entirely and starts already mapped against this
   *  pre-parsed sheet — used by CRM Bulk Import's multi-sheet workbook workflow (`../bulkImport/`),
   *  which parses the whole workbook once upfront and hands each sheet to its own dialog instance
   *  instead of asking the user to upload the same file once per module. */
  initialParsed?: ParsedWorkbook;
  initialFileName?: string;
  /** Header-index -> field key overrides applied on top of the dialog's own auto-mapping — used by
   *  CRM Bulk Import's multi-sheet workflow when a header was resolved to an existing built-in
   *  field by key-collision (see `../bulkImport/crmCustomFieldsService.ts`) rather than by its own
   *  label/alias match, so the mapping step shows it as already matched instead of Unmapped. */
  initialMappingOverrides?: HeaderMapping;
}

export function BulkImportDialog<T>({
  open,
  onOpenChange,
  title,
  fields,
  duplicate,
  commitImport,
  fileBaseName,
  helperNote,
  initialParsed,
  initialFileName,
  initialMappingOverrides,
}: BulkImportDialogProps<T>) {
  const importableFields = useMemo(
    () => fields.filter((f) => !f.exportOnly),
    [fields],
  );
  const [step, setStep] = useState<Step>(initialParsed ? "mapping" : "upload");
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(
    initialParsed ?? null,
  );
  const [mapping, setMapping] = useState<HeaderMapping>(() =>
    initialParsed
      ? {
          ...autoMatchHeaders(initialParsed.headers, importableFields),
          ...initialMappingOverrides,
        }
      : {},
  );
  const [strategy, setStrategy] = useState<DuplicateStrategy>("skip");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [fileName, setFileName] = useState(initialFileName ?? "");
  // The Firebase write is one atomic multi-path `update()` call — there's no per-row progress
  // event to report a real percentage from. Rather than show a fixed, always-wrong 70%, this
  // climbs toward (but never reaches) 90% while the import is in flight, so it reads as "still
  // working" instead of a number that means nothing; `step === 'result'` snaps it to 100%.
  const [importProgress, setImportProgress] = useState(10);

  useEffect(() => {
    if (step !== "importing") return;
    setImportProgress(10);
    const id = setInterval(
      () => setImportProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.2)),
      300,
    );
    return () => clearInterval(id);
  }, [step]);

  const reset = () => {
    setStep(initialParsed ? "mapping" : "upload");
    setParsed(initialParsed ?? null);
    setMapping(
      initialParsed
        ? {
            ...autoMatchHeaders(initialParsed.headers, importableFields),
            ...initialMappingOverrides,
          }
        : {},
    );
    setStrategy("skip");
    setBusy(false);
    setResult(null);
    setFileName(initialFileName ?? "");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const wb = await parseWorkbookFile(file);
      if (wb.headers.length === 0) {
        toast.error("That file has no readable rows/headers.");
        return;
      }
      setFileName(file.name);
      setParsed(wb);
      setMapping(autoMatchHeaders(wb.headers, importableFields));
      setStep("mapping");
    } catch (err) {
      console.error("Failed to read Excel file:", err);
      toast.error(
        "Could not read that file — make sure it is a valid .xlsx/.xls/.csv export.",
      );
    } finally {
      setBusy(false);
    }
  };

  // `mapping` changes on every header-dropdown click, and `buildMappedRows` re-validates every row
  // (including a per-row duplicate-detection scan against all existing records) — on a
  // few-thousand-row import that recompute is heavy enough to visibly freeze the UI if it runs
  // synchronously in the same render as the click. `useDeferredValue` lets the dropdown's own
  // selection update immediately while this recompute happens in a deprioritized background pass.
  const deferredMapping = useDeferredValue(mapping);
  const mappedRows: MappedImportRow[] = useMemo(() => {
    if (!parsed) return [];
    return buildMappedRows(
      parsed,
      deferredMapping,
      importableFields,
      duplicate,
    );
  }, [parsed, deferredMapping, importableFields, duplicate]);

  const validRows = mappedRows.filter((r) => r.errors.length === 0);
  const invalidRows = mappedRows.filter((r) => r.errors.length > 0);
  const duplicateRows = validRows.filter((r) => r.isDuplicate);
  const requiredUnmapped = importableFields.filter(
    (f) => f.required && !Object.values(mapping).includes(f.key),
  );

  const handleConfirmImport = async () => {
    // Duplicate rows are still passed through to `commitImport` even under the 'skip' strategy —
    // `commitFirebaseImport` is what actually counts/skips them per row (that's the only place
    // the "Skipped" stat and audit-log summary get their number from). Pre-filtering them out here
    // meant it saw zero duplicates and always reported 0 skipped, no matter how many there were.
    if (validRows.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }
    setStep("importing");
    setBusy(true);
    try {
      const summary = await commitImport(validRows, strategy);
      setImportProgress(100);
      setResult(summary);
      setStep("result");
    } catch (err) {
      console.error("Bulk import failed:", err);
      toast.error(err instanceof Error ? err.message : "Bulk import failed.");
      setStep("preview");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import — {title}</DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload an Excel file (.xlsx, .xls or .csv) containing multiple records."}
            {step === "mapping" &&
              "Confirm how each Excel column maps to a CRM field, then preview."}
            {step === "preview" &&
              "Review validation results before importing."}
            {step === "importing" && "Importing records…"}
            {step === "result" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && helperNote && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{helperNote}</span>
          </div>
        )}

        {step === "upload" && (
          <>
            <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-10 cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 transition-colors">
              <UploadCloud className="h-9 w-9 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">
                Click to choose an Excel file
              </p>
              <p className="text-sm text-slate-400">.xlsx, .xls or .csv</p>
              {busy && (
                <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl gap-1.5 text-xs text-slate-500 mx-auto"
              onClick={() =>
                downloadImportTemplate(importableFields, title, fileBaseName)
              }
            >
              <Download className="h-3.5 w-3.5" /> Don't have a file yet?
              Download the {title} import template
            </Button>
          </>
        )}

        {step === "mapping" && parsed && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FileSpreadsheet className="h-4 w-4" /> {fileName} —{" "}
              {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}{" "}
              detected
            </div>
            {requiredUnmapped.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Required field{requiredUnmapped.length === 1 ? "" : "s"} not
                  mapped yet: {requiredUnmapped.map((f) => f.label).join(", ")}
                </span>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase text-slate-500">
                      Excel Header
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase text-slate-500">
                      CRM Field
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.headers.map((h, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm text-slate-700 font-medium">
                        {h || `(Column ${idx + 1})`}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[idx] ?? "__ignore__"}
                          onValueChange={(v) =>
                            setMapping((prev) => ({
                              ...prev,
                              [idx]: v === "__ignore__" ? null : v,
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 rounded-xl w-64">
                            <SelectValue placeholder="Unmapped" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignore__">
                              — Ignore this column —
                            </SelectItem>
                            {importableFields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                                {f.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={() =>
                  setMapping(autoMatchHeaders(parsed.headers, importableFields))
                }
              >
                Reset to auto-mapping
              </Button>
              <Button
                className="rounded-xl gap-1.5"
                onClick={() => setStep("preview")}
                disabled={requiredUnmapped.length > 0}
              >
                Preview <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Total Rows"
                value={mappedRows.length}
                icon={FileSpreadsheet}
                tone="slate"
              />
              <StatCard
                label="Valid"
                value={validRows.length}
                icon={CheckCircle2}
                tone="emerald"
              />
              <StatCard
                label="Invalid"
                value={invalidRows.length}
                icon={XCircle}
                tone="red"
              />
              <StatCard
                label="Duplicates"
                value={duplicateRows.length}
                icon={AlertTriangle}
                tone="amber"
              />
            </div>

            {duplicate && duplicateRows.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-sm font-bold text-slate-600">
                  Duplicate rows found — how should they be handled?
                </p>
                <Select
                  value={strategy}
                  onValueChange={(v) => setStrategy(v as DuplicateStrategy)}
                >
                  <SelectTrigger className="h-9 rounded-xl w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip duplicates</SelectItem>
                    <SelectItem value="update">
                      Update existing records
                    </SelectItem>
                    <SelectItem value="create">
                      Create as new records anyway
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {invalidRows.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-red-700">
                    {invalidRows.length} row
                    {invalidRows.length === 1 ? "" : "s"} will be skipped due to
                    errors
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-red-700"
                    onClick={() =>
                      downloadErrorReport(
                        invalidRows.flatMap((r) =>
                          r.errors.map((e) => ({
                            rowNumber: r.rowNumber,
                            message: e,
                          })),
                        ),
                        fileBaseName,
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" /> Download error report
                  </Button>
                </div>
                {invalidRows.slice(0, 8).map((r) => (
                  <p key={r.rowNumber} className="text-sm text-red-700">
                    Row {r.rowNumber}: {r.errors.join("; ")}
                  </p>
                ))}
                {invalidRows.length > 8 && (
                  <p className="text-sm text-red-500">
                    …and {invalidRows.length - 8} more
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <p className="text-sm font-bold text-slate-500 px-3 py-2 bg-slate-50/70 border-b border-slate-200">
                Sample preview (first 10 valid rows)
              </p>
              <div className="overflow-x-auto max-h-64">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow>
                      {importableFields
                        .filter((f) => Object.values(mapping).includes(f.key))
                        .map((f) => (
                          <TableHead
                            key={f.key}
                            className="text-xs font-bold text-slate-500 whitespace-nowrap"
                          >
                            {f.label}
                          </TableHead>
                        ))}
                      <TableHead className="text-xs font-bold text-slate-500">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.slice(0, 10).map((r) => (
                      <TableRow key={r.rowNumber}>
                        {importableFields
                          .filter((f) => Object.values(mapping).includes(f.key))
                          .map((f) => (
                            <TableCell
                              key={f.key}
                              className="text-sm text-slate-700 whitespace-nowrap max-w-[160px] truncate"
                            >
                              {String(r.data[f.key] ?? "—")}
                            </TableCell>
                          ))}
                        <TableCell>
                          {r.isDuplicate ? (
                            <Badge
                              variant="outline"
                              className="text-xs text-amber-700 border-amber-200 bg-amber-50"
                            >
                              Duplicate of {r.duplicateLabel}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50"
                            >
                              New
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={() => setStep("mapping")}
              >
                <ArrowLeft className="h-4 w-4" /> Back to Mapping
              </Button>
              <Button
                className="rounded-xl gap-1.5"
                onClick={handleConfirmImport}
                disabled={
                  busy ||
                  (strategy === "skip"
                    ? validRows.filter((r) => !r.isDuplicate).length === 0
                    : validRows.length === 0)
                }
              >
                Confirm Import (
                {strategy === "skip"
                  ? validRows.filter((r) => !r.isDuplicate).length
                  : validRows.length}{" "}
                row
                {(strategy === "skip"
                  ? validRows.filter((r) => !r.isDuplicate).length
                  : validRows.length) === 1
                  ? ""
                  : "s"}
                )
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="text-sm text-slate-600">
              Importing records — please don't close this window…
            </p>
            <Progress value={importProgress} className="w-full max-w-xs" />
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Total Rows"
                value={result.totalRows}
                icon={FileSpreadsheet}
                tone="slate"
              />
              <StatCard
                label="Created"
                value={result.created}
                icon={CheckCircle2}
                tone="emerald"
              />
              <StatCard
                label="Updated"
                value={result.updated}
                icon={CheckCircle2}
                tone="blue"
              />
              <StatCard
                label="Skipped"
                value={result.skipped}
                icon={AlertTriangle}
                tone="amber"
              />
            </div>
            {result.failed > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
                <p className="text-sm font-bold text-red-700">
                  {result.failed} row{result.failed === 1 ? "" : "s"} failed to
                  import
                </p>
                {result.errors?.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-sm text-red-600">
                    {e}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button className="rounded-xl" onClick={() => handleClose(false)}>
                Done
              </Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

const STAT_TONE: Record<string, string> = {
  slate: "bg-slate-50 text-slate-700 border-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof FileSpreadsheet;
  tone: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${STAT_TONE[tone]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
