"use client";

import type { CrmImportEntity } from "@texawave-erp/api-types";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
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
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Loader2,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  downloadErrorReport,
  parseWorkbookFile,
  type ParsedSheet,
} from "../excel";
import { detectSheetKind, type CrmSheetKind } from "../mapping";
import { ImportDialog, type ImportOutcome } from "./ImportDialog";

type ImportableKind = Exclude<CrmSheetKind, "overall-data" | "unrecognized">;

const KIND_LABEL: Record<
  ImportableKind,
  { label: string; entity: CrmImportEntity; fileBase: string; route: string }
> = {
  "mining-rows": {
    label: "Accounts Mining Sheet",
    entity: "mining-rows",
    fileBase: "crm-accounts-mining",
    route: "/crm/accounts-mining-sheet",
  },
  leads: {
    label: "Leads",
    entity: "leads",
    fileBase: "crm-leads",
    route: "/crm/leads",
  },
  meetings: {
    label: "Yet to Happen (Meetings)",
    entity: "meetings",
    fileBase: "crm-yet-to-happen",
    route: "/crm/yet-to-happen",
  },
  "call-back-send-info": {
    label: "Call Back - Send Info",
    entity: "call-back-send-info",
    fileBase: "crm-call-back-send-info",
    route: "/crm/callback-send-info",
  },
  "not-interested": {
    label: "Not Interested",
    entity: "not-interested",
    fileBase: "crm-not-interested",
    route: "/crm/not-interested",
  },
  "keep-in-touch": {
    label: "Keep in Touch",
    entity: "keep-in-touch",
    fileBase: "crm-keep-in-touch",
    route: "/crm/keep-in-touch",
  },
  "cold-calling": {
    label: "Cold Calling Status",
    entity: "cold-calling",
    fileBase: "crm-cold-calling",
    route: "/crm/cold-calling-status",
  },
};

interface SheetEntry {
  sheet: ParsedSheet;
  kind: CrmSheetKind;
  outcome?: ImportOutcome;
}

type Step = "upload" | "analysis" | "summary";

const TONE: Record<string, string> = {
  slate: "bg-slate-50 text-slate-700 border-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
};

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONE;
}) {
  return (
    <div className={`rounded-xl border p-3 ${TONE[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

/** Legacy CrmBulkImport: the header-level "Bulk Import" modal. One workbook
 * with several CRM sheets; each sheet is detected by name and routed to its
 * own module's import (mapping, preview, duplicate strategy and commit all
 * reuse ImportDialog). The /crm/bulk-import route renders it open. */
export function BulkImportPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<Step>("upload");
  const [entries, setEntries] = useState<SheetEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<number | null>(null);

  function reset() {
    setStep("upload");
    setBusy(false);
    setFileName("");
    setEntries([]);
    setReviewing(null);
  }

  function handleClose(next: boolean) {
    if (next) return;
    setOpen(false);
    reset();
    router.push("/crm/dashboard");
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const sheets = (await parseWorkbookFile(file)).filter(
        (s) => s.headers.length > 0,
      );
      if (sheets.length === 0) {
        toast.error("That workbook has no readable sheets/headers.");
        return;
      }
      setFileName(file.name);
      setEntries(
        sheets.map((sheet) => ({ sheet, kind: detectSheetKind(sheet.name) })),
      );
      setStep("analysis");
    } catch {
      toast.error(
        "Could not read that file — make sure it is a valid .xlsx/.xls workbook.",
      );
    } finally {
      setBusy(false);
    }
  }

  const overall = entries.find((e) => e.kind === "overall-data");
  const unrecognized = entries.filter((e) => e.kind === "unrecognized");
  const importable = entries.filter(
    (e) => e.kind !== "overall-data" && e.kind !== "unrecognized",
  );
  const active = reviewing === null ? undefined : entries[reviewing];
  const activeCfg =
    active && active.kind in KIND_LABEL
      ? KIND_LABEL[active.kind as ImportableKind]
      : undefined;

  const totals = importable.reduce(
    (acc, e) => ({
      totalRows: acc.totalRows + (e.outcome?.totalRows ?? 0),
      created: acc.created + (e.outcome?.created ?? 0),
      updated: acc.updated + (e.outcome?.updated ?? 0),
      skipped: acc.skipped + (e.outcome?.skipped ?? 0),
      failed: acc.failed + (e.outcome?.failed ?? 0),
    }),
    { totalRows: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="rounded-2xl max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CRM Bulk Import</DialogTitle>
            <DialogDescription>
              {step === "upload" &&
                "Upload one Excel workbook containing multiple CRM sheets — each sheet is routed to its own module automatically."}
              {step === "analysis" &&
                "Review each detected sheet, confirm its mapping, and import it into the correct CRM module."}
              {step === "summary" && "Bulk import complete."}
            </DialogDescription>
          </DialogHeader>

          {step === "upload" && (
            <>
              <label
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-10 cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
              >
                <UploadCloud className="h-9 w-9 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">
                  Choose Excel File — or drag and drop it here
                </p>
                <p className="text-sm text-slate-400">
                  .xlsx or .xls — every sheet in the workbook is read
                </p>
                {busy && (
                  <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="text-xs text-slate-400">
                Recognised sheet names: Accounts Mining Sheet, Leads, Yet to
                Happen, Call Back-Send Info, Not Interested, Keep in Touch, Cold
                Calling Status.
              </p>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                  onClick={() => handleClose(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}

          {step === "analysis" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <FileSpreadsheet className="h-4 w-4" /> Workbook:{" "}
                <span className="font-semibold text-slate-700">{fileName}</span>{" "}
                — {entries.length} sheet{entries.length === 1 ? "" : "s"}{" "}
                detected
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow>
                      {[
                        "Sheet",
                        "Target Module",
                        "Columns",
                        "Rows",
                        "Status",
                      ].map((h) => (
                        <TableHead
                          key={h}
                          className="text-xs font-bold uppercase text-slate-500"
                        >
                          {h}
                        </TableHead>
                      ))}
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importable.map((e) => {
                      const idx = entries.indexOf(e);
                      const cfg = KIND_LABEL[e.kind as ImportableKind];
                      return (
                        <TableRow key={e.sheet.name}>
                          <TableCell className="text-sm font-medium text-slate-700">
                            {e.sheet.name}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {cfg.label}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {e.sheet.headers.length}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {e.sheet.rows.length}
                          </TableCell>
                          <TableCell>
                            {e.outcome ? (
                              e.outcome.failed > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-amber-700 border-amber-200 bg-amber-50"
                                >
                                  Imported — {e.outcome.failed} failed
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />{" "}
                                  Imported
                                </Badge>
                              )
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-slate-600 border-slate-200 bg-slate-50"
                              >
                                Ready
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl gap-1.5 h-8"
                              onClick={() => setReviewing(idx)}
                            >
                              {e.outcome ? "Re-review" : "Review & Map"}{" "}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {overall && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-2">
                  <div className="flex items-start gap-2 text-sm text-sky-800">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-bold">{overall.sheet.name}</span> is
                      a computed disposition summary, not a record table — the
                      CRM&apos;s Overall Data tab derives these numbers live
                      from Accounts Mining, Leads, Meetings and Account status
                      changes. It is not imported directly; once the sheets
                      above are imported, Overall Data updates automatically.
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-40 rounded-lg border border-sky-200/70 bg-white">
                    <Table>
                      <TableHeader className="bg-sky-50/70">
                        <TableRow>
                          {overall.sheet.headers.slice(0, 8).map((h, i) => (
                            <TableHead
                              key={i}
                              className="text-xs font-bold text-sky-700 whitespace-nowrap"
                            >
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overall.sheet.rows.slice(0, 5).map((r, i) => (
                          <TableRow key={i}>
                            {r.slice(0, 8).map((c, j) => (
                              <TableCell
                                key={j}
                                className="text-xs text-slate-600 whitespace-nowrap"
                              >
                                {c || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {unrecognized.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4" /> Unrecognized Sheets —
                    not imported
                  </div>
                  {unrecognized.map((e) => (
                    <p key={e.sheet.name} className="text-sm text-amber-700">
                      {e.sheet.name} ({e.sheet.rows.length} rows) — sheet name
                      didn&apos;t match a supported CRM sheet.
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={reset}
                >
                  <RotateCcw className="h-4 w-4" /> Start Over
                </Button>
                <Button
                  className="rounded-xl gap-1.5"
                  onClick={() => setStep("summary")}
                >
                  View Import Summary <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "summary" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <SummaryStat
                  label="Total Rows"
                  value={totals.totalRows}
                  tone="slate"
                />
                <SummaryStat
                  label="Created"
                  value={totals.created}
                  tone="emerald"
                />
                <SummaryStat
                  label="Updated"
                  value={totals.updated}
                  tone="blue"
                />
                <SummaryStat
                  label="Skipped"
                  value={totals.skipped}
                  tone="amber"
                />
                <SummaryStat label="Failed" value={totals.failed} tone="red" />
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow>
                      {["Sheet", "Created", "Updated", "Skipped", "Failed"].map(
                        (h) => (
                          <TableHead
                            key={h}
                            className="text-xs font-bold uppercase text-slate-500"
                          >
                            {h}
                          </TableHead>
                        ),
                      )}
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">
                        View
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importable.map((e) => {
                      const cfg = KIND_LABEL[e.kind as ImportableKind];
                      return (
                        <TableRow key={e.sheet.name}>
                          <TableCell className="text-sm font-medium text-slate-700">
                            {e.sheet.name}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {e.outcome?.created ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {e.outcome?.updated ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {e.outcome?.skipped ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {e.outcome?.failed ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {e.outcome?.created || e.outcome?.updated ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => {
                                  setOpen(false);
                                  router.push(cfg.route);
                                }}
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totals.failed > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-red-700">
                    {totals.failed} row{totals.failed === 1 ? "" : "s"} failed
                    across this import
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-red-700"
                    onClick={() =>
                      void downloadErrorReport(
                        importable
                          .filter((e) => (e.outcome?.failed ?? 0) > 0)
                          .map((e, i) => ({
                            rowNumber: i + 1,
                            message: `${e.sheet.name} — ${e.outcome?.failed} row(s) failed`,
                          })),
                        "crm-bulk-import",
                      )
                    }
                  >
                    Download error report
                  </Button>
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={reset}
                >
                  <RotateCcw className="h-4 w-4" /> Import Another File
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => handleClose(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {active && activeCfg && (
        <ImportDialog
          key={active.sheet.name}
          open
          onClose={() => setReviewing(null)}
          entity={activeCfg.entity}
          title={activeCfg.label}
          fileBaseName={activeCfg.fileBase}
          initialSheet={active.sheet}
          initialFileName={fileName}
          onFinished={(outcome) =>
            setEntries((prev) =>
              prev.map((e, i) => (i === reviewing ? { ...e, outcome } : e)),
            )
          }
        />
      )}
    </>
  );
}
