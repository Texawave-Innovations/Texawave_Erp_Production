"use client";

import type {
  CrmImportDuplicateStrategy,
  CrmImportEntity,
  CrmImportFieldSpec,
  CrmImportRowResult,
} from "@texawave-erp/api-types";
import { CRM_IMPORT_MAX_ROWS_PER_REQUEST } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
import { Progress } from "@/components/legacy-ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Stat } from "./Stat";
import { useEffect, useRef, useState } from "react";
import { commitImport, getImportFields, matchImportHeaders } from "../api";
import { useInvalidateCrmAfterImport } from "../hooks";
import {
  downloadErrorReport,
  downloadImportTemplate,
  parseWorkbookFile,
  type ParsedSheet,
} from "../excel";
import {
  buildImportRows,
  chunk,
  CUSTOM_COLUMN,
  IGNORE_COLUMN,
  initialTargets,
  missingRequiredFields,
} from "../mapping";

type Step = "upload" | "mapping" | "preview" | "importing" | "result";

export interface ImportOutcome {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  entity: CrmImportEntity;
  title: string;
  fileBaseName: string;
  /** Multi-sheet importer: skips the upload step with an already-parsed sheet. */
  initialSheet?: ParsedSheet | undefined;
  initialFileName?: string | undefined;
  onFinished?: ((outcome: ImportOutcome) => void) | undefined;
}

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : "Something went wrong";
}

export function ImportDialog(props: ImportDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(v) => !v && props.onClose()}>
      <DialogContent className="rounded-2xl max-w-3xl max-h-[85vh] overflow-y-auto">
        {/* Mounted only while open so every open starts from a clean state. */}
        {props.open ? <ImportBody {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({
  onClose,
  entity,
  title,
  fileBaseName,
  initialSheet,
  initialFileName,
  onFinished,
}: ImportDialogProps) {
  const invalidate = useInvalidateCrmAfterImport();
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState(initialFileName ?? "");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fields, setFields] = useState<CrmImportFieldSpec[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [autoTargets, setAutoTargets] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(10);
  const [strategy, setStrategy] = useState<CrmImportDuplicateStrategy>("skip");
  const [dryRows, setDryRows] = useState<CrmImportRowResult[]>([]);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [resultRows, setResultRows] = useState<CrmImportRowResult[]>([]);
  const [newCustom, setNewCustom] = useState<string[]>([]);
  const startedRef = useRef(false);

  const fieldsQuery = useQuery({
    queryKey: ["crm-import-fields-dialog", entity],
    queryFn: () => getImportFields(entity),
  });

  useEffect(() => {
    if (step !== "importing") return;
    const id = setInterval(
      () => setImportProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.2)),
      300,
    );
    return () => clearInterval(id);
  }, [step]);

  async function loadSheet(next: ParsedSheet) {
    setBusy(true);
    setError(null);
    try {
      if (next.headers.length === 0 || next.rows.length === 0) {
        setError("That sheet has no readable header row or data rows.");
        return;
      }
      const res = await matchImportHeaders(entity, next.headers);
      setSheet(next);
      setFields(res.fields);
      const auto = initialTargets(next.headers, res.mapping);
      setTargets(auto);
      setAutoTargets(auto);
      setStep("mapping");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  // Multi-sheet importer hands over the parsed sheet once.
  useEffect(() => {
    if (initialSheet && !startedRef.current) {
      startedRef.current = true;
      void loadSheet(initialSheet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; guarded by startedRef
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const sheets = await parseWorkbookFile(file);
      const first = sheets.find((s) => s.headers.length > 0);
      if (!first) {
        setError("That file has no readable rows or headers.");
        setBusy(false);
        return;
      }
      setFileName(file.name);
      setBusy(false);
      await loadSheet(first);
    } catch {
      setBusy(false);
      setError("Could not read that file. Use a valid .xlsx, .xls or .csv.");
    }
  }

  async function runPreview() {
    if (!sheet) return;
    setStep("preview");
    setBusy(true);
    setError(null);
    try {
      const rows: CrmImportRowResult[] = [];
      for (const part of chunk(
        buildImportRows(sheet, targets),
        CRM_IMPORT_MAX_ROWS_PER_REQUEST,
      )) {
        const res = await commitImport(entity, {
          strategy,
          dryRun: true,
          rows: part,
        });
        rows.push(...res.rows);
      }
      setDryRows(rows);
    } catch (err) {
      setError(messageOf(err));
      setStep("mapping");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!sheet) return;
    setImportProgress(10);
    setStep("importing");
    setBusy(true);
    setError(null);
    try {
      const rows: CrmImportRowResult[] = [];
      const created = new Set<string>();
      for (const part of chunk(
        buildImportRows(sheet, targets),
        CRM_IMPORT_MAX_ROWS_PER_REQUEST,
      )) {
        const res = await commitImport(entity, { strategy, rows: part });
        rows.push(...res.rows);
        res.newCustomFields.forEach((l) => created.add(l));
      }
      const count = (...s: CrmImportRowResult["status"][]) =>
        rows.filter((r) => s.includes(r.status)).length;
      const summary: ImportOutcome = {
        totalRows: rows.length,
        created: count("created"),
        updated: count("updated"),
        skipped: count("skipped"),
        failed: count("failed", "invalid"),
      };
      setResultRows(rows);
      setNewCustom([...created]);
      setOutcome(summary);
      setImportProgress(100);
      setStep("result");
      await invalidate();
      onFinished?.(summary);
    } catch (err) {
      setError(messageOf(err));
      setStep("preview");
    } finally {
      setBusy(false);
    }
  }

  const missing = missingRequiredFields(fields, targets);
  const invalid = dryRows.filter((r) => r.status === "invalid");
  const duplicates = dryRows.filter((r) => r.status === "duplicate");
  const validCount = dryRows.filter(
    (r) => r.status === "valid" || r.status === "duplicate",
  ).length;
  const importable =
    strategy === "skip" ? validCount - duplicates.length : validCount;
  const errorIssues = (rows: CrmImportRowResult[]) =>
    rows
      .filter((r) => r.errors.length > 0)
      .flatMap((r) =>
        r.errors.map((message) => ({ rowNumber: r.rowNumber, message })),
      );

  const mappedFieldCols = fields
    .map((f) => ({ f, col: targets.indexOf(f.key) }))
    .filter((x) => x.col >= 0);
  const sampleRows = dryRows
    .filter((r) => r.status === "valid" || r.status === "duplicate")
    .slice(0, 10);

  const STEP_DESCRIPTION: Record<Step, string> = {
    upload:
      "Upload an Excel file (.xlsx, .xls or .csv) containing multiple records.",
    mapping: "Confirm how each Excel column maps to a CRM field, then preview.",
    preview: "Review validation results before importing.",
    importing: "Importing records…",
    result: "Import complete.",
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bulk Import — {title}</DialogTitle>
        <DialogDescription>{STEP_DESCRIPTION[step]}</DialogDescription>
      </DialogHeader>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
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
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl gap-1.5 text-xs text-slate-500 mx-auto"
            disabled={!fieldsQuery.data}
            onClick={() =>
              void downloadImportTemplate(
                (fieldsQuery.data?.fields ?? []).map((f) => f.label),
                title,
                fileBaseName,
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Don&apos;t have a file yet?
            Download the {title} import template
          </Button>
          {fieldsQuery.isError && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>You may not have permission to import {title}.</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              onClick={onClose}
            >
              Cancel
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "mapping" && sheet && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <FileSpreadsheet className="h-4 w-4" /> {fileName || sheet.name} —{" "}
            {sheet.rows.length} row{sheet.rows.length === 1 ? "" : "s"} detected
          </div>
          <p className="text-xs text-slate-400">
            Columns are matched to CRM fields by exact name or alias;
            unrecognised columns create a custom field unless ignored.
          </p>
          {missing.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Required field{missing.length === 1 ? "" : "s"} not mapped yet:{" "}
                {missing.map((f) => f.label).join(", ")}
              </span>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
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
                {sheet.headers.map((h, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm text-slate-700 font-medium">
                      {h || `(Column ${idx + 1})`}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={targets[idx] ?? IGNORE_COLUMN}
                        onValueChange={(v) =>
                          setTargets((prev) =>
                            prev.map((t, i) => (i === idx ? v : t)),
                          )
                        }
                      >
                        <SelectTrigger
                          className="h-9 rounded-xl w-64"
                          aria-label={`Field for ${h || `column ${idx + 1}`}`}
                        >
                          <SelectValue placeholder="Unmapped" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={IGNORE_COLUMN}>
                            — Ignore this column —
                          </SelectItem>
                          <SelectItem value={CUSTOM_COLUMN}>
                            + Custom field (auto-create)
                          </SelectItem>
                          {fields.map((f) => (
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
              onClick={() => setTargets(autoTargets)}
            >
              Reset to auto-mapping
            </Button>
            <Button
              className="rounded-xl gap-1.5"
              onClick={() => void runPreview()}
              disabled={missing.length > 0}
            >
              Preview <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {busy ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-500" />{" "}
              Validating rows…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                  label="Total Rows"
                  value={dryRows.length}
                  icon={FileSpreadsheet}
                  tone="slate"
                />
                <Stat
                  label="Valid"
                  value={validCount}
                  icon={CheckCircle2}
                  tone="emerald"
                />
                <Stat
                  label="Invalid"
                  value={invalid.length}
                  icon={XCircle}
                  tone="red"
                />
                <Stat
                  label="Duplicates"
                  value={duplicates.length}
                  icon={AlertTriangle}
                  tone="amber"
                />
              </div>

              {duplicates.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-sm font-bold text-slate-600">
                    Duplicate rows found — how should they be handled?
                  </p>
                  <Select
                    value={strategy}
                    onValueChange={(v) =>
                      setStrategy(v as CrmImportDuplicateStrategy)
                    }
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

              {invalid.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-red-700">
                      {invalid.length} row{invalid.length === 1 ? "" : "s"} will
                      be skipped due to errors
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs gap-1 text-red-700"
                      onClick={() =>
                        void downloadErrorReport(
                          errorIssues(invalid),
                          fileBaseName,
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" /> Download error report
                    </Button>
                  </div>
                  {invalid.slice(0, 8).map((r) => (
                    <p key={r.rowNumber} className="text-sm text-red-700">
                      Row {r.rowNumber}: {r.errors.join("; ")}
                    </p>
                  ))}
                  {invalid.length > 8 && (
                    <p className="text-sm text-red-500">
                      …and {invalid.length - 8} more
                    </p>
                  )}
                </div>
              )}

              {sheet && sampleRows.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <p className="text-sm font-bold text-slate-500 px-3 py-2 bg-slate-50/70 border-b border-slate-200">
                    Sample preview (first 10 valid rows)
                  </p>
                  <div className="overflow-x-auto max-h-64">
                    <Table>
                      <TableHeader className="bg-slate-50/70">
                        <TableRow>
                          {mappedFieldCols.map(({ f }) => (
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
                        {sampleRows.map((r) => (
                          <TableRow key={r.rowNumber}>
                            {mappedFieldCols.map(({ f, col }) => (
                              <TableCell
                                key={f.key}
                                className="text-sm text-slate-700 whitespace-nowrap max-w-[160px] truncate"
                              >
                                {sheet.rows[r.rowNumber - 1]?.[col] || "—"}
                              </TableCell>
                            ))}
                            <TableCell>
                              {r.status === "duplicate" ? (
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
              )}

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
                  onClick={() => void runImport()}
                  disabled={importable === 0 && strategy !== "update"}
                >
                  Confirm Import ({importable} row
                  {importable === 1 ? "" : "s"})
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "importing" && (
        <div className="py-10 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm text-slate-600">
            Importing records — please don&apos;t close this window…
          </p>
          <Progress value={importProgress} className="w-full max-w-xs" />
        </div>
      )}

      {step === "result" && outcome && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Total Rows"
              value={outcome.totalRows}
              icon={FileSpreadsheet}
              tone="slate"
            />
            <Stat
              label="Created"
              value={outcome.created}
              icon={CheckCircle2}
              tone="emerald"
            />
            <Stat
              label="Updated"
              value={outcome.updated}
              icon={CheckCircle2}
              tone="blue"
            />
            <Stat
              label="Skipped"
              value={outcome.skipped}
              icon={AlertTriangle}
              tone="amber"
            />
          </div>
          {newCustom.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-sm text-blue-700">
              New custom field{newCustom.length === 1 ? "" : "s"} created:{" "}
              {newCustom.join(", ")}
            </div>
          )}
          {outcome.failed > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-red-700">
                  {outcome.failed} row{outcome.failed === 1 ? "" : "s"} failed
                  to import
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1 text-red-700"
                  onClick={() =>
                    void downloadErrorReport(
                      errorIssues(resultRows),
                      fileBaseName,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Download error report
                </Button>
              </div>
              {resultRows
                .filter((r) => r.errors.length > 0)
                .slice(0, 5)
                .map((r) => (
                  <p key={r.rowNumber} className="text-sm text-red-600">
                    Row {r.rowNumber}: {r.errors.join("; ")}
                  </p>
                ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button className="rounded-xl" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
