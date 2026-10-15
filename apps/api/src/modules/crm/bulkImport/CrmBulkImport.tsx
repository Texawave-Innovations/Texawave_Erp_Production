// CRM Bulk Import — the header-level "Bulk Import" workflow (CRMLayout.tsx, next to Search). Reads
// ONE Excel workbook containing several CRM sheets (Accounts Mining Sheet, Leads, Yet to Happen,
// Call Back-Send Info, Not Interested, Keep in Touch, Overall Data) and routes each sheet to its
// own module in one pass, instead of the user uploading the same file once per tab.
//
// This is additive, on top of the existing single-sheet Bulk Import engine in `../importExport/`:
// each sheet's mapping/preview/validation/duplicate-handling/import step reuses `BulkImportDialog`
// as-is (pre-loaded with that sheet's already-parsed data via its `initialParsed` prop), so nothing
// about the existing per-tab "Import Data" buttons on Leads/Accounts/etc. changes or is duplicated.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { BulkImportDialog } from "../importExport/BulkImportDialog";
import { autoMatchHeaders } from "../importExport/fieldMatch";
import {
  parseWorkbookAllSheets,
  downloadErrorReport,
  ParsedWorkbookSheet,
} from "../importExport/excelIO";
import {
  DuplicateStrategy,
  HeaderMapping,
  ImportSummary,
  MappedImportRow,
} from "../importExport/types";
import {
  detectSheetKind,
  moduleForSheetKind,
  useCrmBulkImportRegistry,
} from "./crmBulkImportSheets";
import { getOrCreateCrmCustomField } from "./crmCustomFieldsService";
import {
  CrmBulkImportSheetEntry,
  CrmBulkImportSheetKind,
  SHEET_MODULE_LABEL,
} from "./crmBulkImportTypes";

const SHEET_ROUTE: Partial<Record<CrmBulkImportSheetKind, string>> = {
  accountsMining: "/crm/accounts-mining-sheet",
  leads: "/crm/leads",
  yetToHappen: "/crm/yet-to-happen",
  callBackSendInfo: "/crm/call-back-send-info",
  notInterested: "/crm/not-interested",
  keepInTouch: "/crm/keep-in-touch",
  coldCalling: "/crm/cold-calling-status",
  overallData: "/crm/overall-data",
};

const NON_IMPORTABLE: CrmBulkImportSheetKind[] = [
  "overallData",
  "unrecognized",
];

type Step = "upload" | "analysis" | "summary";

export function CrmBulkImport({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const registry = useCrmBulkImportRegistry(currentUser);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedWorkbookSheet[]>([]);
  const [entries, setEntries] = useState<CrmBulkImportSheetEntry[]>([]);
  const [reviewingKind, setReviewingKind] =
    useState<CrmBulkImportSheetKind | null>(null);
  const [creatingFieldsForKind, setCreatingFieldsForKind] =
    useState<CrmBulkImportSheetKind | null>(null);
  // Header-index -> field key overrides for the sheet currently being reviewed — set only for
  // headers `handleReviewSheet` resolved to an existing BUILT-IN field by key-collision (see
  // crmCustomFieldsService.ts's getOrCreateCrmCustomField), so the mapping step shows them as
  // already matched instead of Unmapped or wrongly-custom.
  const [reviewMappingOverrides, setReviewMappingOverrides] =
    useState<HeaderMapping>({});

  const reset = () => {
    setStep("upload");
    setBusy(false);
    setFileName("");
    setSheets([]);
    setEntries([]);
    setReviewingKind(null);
    setCreatingFieldsForKind(null);
    setReviewMappingOverrides({});
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const parsedSheets = await parseWorkbookAllSheets(file);
      const nonEmpty = parsedSheets.filter((s) => s.parsed.headers.length > 0);
      if (nonEmpty.length === 0) {
        toast.error("That workbook has no readable sheets/headers.");
        return;
      }
      setFileName(file.name);
      setSheets(nonEmpty);
      setEntries(
        nonEmpty.map((s) => {
          const kind = detectSheetKind(s.sheetName);
          return {
            sheetName: s.sheetName,
            kind,
            columnCount: s.parsed.headers.length,
            rowCount: s.parsed.rows.length,
            importable: !NON_IMPORTABLE.includes(kind),
            reviewed: false,
          };
        }),
      );
      setStep("analysis");
    } catch (err) {
      console.error("Failed to read workbook:", err);
      toast.error(
        "Could not read that file — make sure it is a valid .xlsx/.xls workbook.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  /** Before opening a sheet's review dialog: compare its headers against that module's current
   *  fields (built-in + already-discovered custom) the same way the dialog's own auto-mapping will.
   *  For each header that still doesn't match anything, `getOrCreateCrmCustomField` either
   *  auto-creates a persisted custom field for it, or — when the header's generated key collides
   *  with an existing BUILT-IN field's key (e.g. Leads' "Prospect Name" vs. its built-in
   *  `prospectName` field) — resolves it straight to that base field instead, with no custom field
   *  created at all. Either way, the mapping step that follows shows the header as matched rather
   *  than Unmapped. */
  const handleReviewSheet = async (kind: CrmBulkImportSheetKind) => {
    const sheet = sheets.find((s) => detectSheetKind(s.sheetName) === kind);
    const config = registry[kind];
    const module = moduleForSheetKind(kind);
    if (!sheet || !config) return;

    if (module) {
      const mapping = autoMatchHeaders(sheet.parsed.headers, config.fields);
      const unmatched = sheet.parsed.headers
        .map((h, idx) => ({ h, idx }))
        .filter(({ h, idx }) => h.trim() && mapping[idx] === null);
      if (unmatched.length > 0) {
        setCreatingFieldsForKind(kind);
        const baseFieldKeys = config.fields
          .filter((f) => !f.custom)
          .map((f) => f.key);
        try {
          const overrides: HeaderMapping = {};
          await Promise.all(
            unmatched.map(async ({ h, idx }) => {
              const resolution = await getOrCreateCrmCustomField(
                module,
                h,
                currentUser,
                baseFieldKeys,
              );
              overrides[idx] = resolution.key;
            }),
          );
          setReviewMappingOverrides(overrides);
        } catch (err) {
          console.error("Failed to auto-create custom field(s):", err);
          toast.error(
            "Could not create a field for one or more new columns — they will show as Unmapped.",
          );
          setReviewMappingOverrides({});
        } finally {
          setCreatingFieldsForKind(null);
        }
      } else {
        setReviewMappingOverrides({});
      }
    } else {
      setReviewMappingOverrides({});
    }
    setReviewingKind(kind);
  };

  const reviewingEntry = entries.find((e) => e.kind === reviewingKind);
  const reviewingSheet = sheets.find(
    (s) => detectSheetKind(s.sheetName) === reviewingKind,
  );
  const reviewingConfig = reviewingKind ? registry[reviewingKind] : undefined;

  const wrappedCommit =
    (kind: CrmBulkImportSheetKind) =>
    async (
      rows: MappedImportRow[],
      strategy: DuplicateStrategy,
    ): Promise<ImportSummary> => {
      const config = registry[kind];
      if (!config)
        throw new Error("No import handler configured for this sheet.");
      const summary = await config.commitImport(rows, strategy);
      setEntries((prev) =>
        prev.map((e) =>
          e.kind === kind ? { ...e, reviewed: true, summary } : e,
        ),
      );
      return summary;
    };

  const overallDataSheet = sheets.find(
    (s) => detectSheetKind(s.sheetName) === "overallData",
  );
  const unrecognizedEntries = entries.filter((e) => e.kind === "unrecognized");
  const importableEntries = entries.filter((e) => e.importable);

  const totals = importableEntries.reduce(
    (acc, e) => {
      if (!e.summary) return acc;
      acc.totalRows += e.summary.totalRows;
      acc.created += e.summary.created;
      acc.updated += e.summary.updated;
      acc.skipped += e.summary.skipped;
      acc.failed += e.summary.failed;
      return acc;
    },
    { totalRows: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
  );
  const allErrors = importableEntries.flatMap((e) =>
    (e.summary?.errors || []).map((msg) => `${e.sheetName} — ${msg}`),
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
                onDrop={handleDrop}
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
                    if (file) handleFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
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
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Sheet
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Target Module
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Columns
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Rows
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importableEntries.map((e) => (
                      <TableRow key={e.sheetName}>
                        <TableCell className="text-sm font-medium text-slate-700">
                          {e.sheetName}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {SHEET_MODULE_LABEL[e.kind]}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {e.columnCount}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {e.rowCount}
                        </TableCell>
                        <TableCell>
                          {e.summary ? (
                            e.summary.failed > 0 ? (
                              <Badge
                                variant="outline"
                                className="text-xs text-amber-700 border-amber-200 bg-amber-50"
                              >
                                Imported — {e.summary.failed} failed
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
                            disabled={creatingFieldsForKind === e.kind}
                            onClick={() => handleReviewSheet(e.kind)}
                          >
                            {creatingFieldsForKind === e.kind ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                                Creating fields…
                              </>
                            ) : (
                              <>
                                {e.summary ? "Re-review" : "Review & Map"}{" "}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {overallDataSheet && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-2">
                  <div className="flex items-start gap-2 text-sm text-sky-800">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-bold">
                        {overallDataSheet.sheetName}
                      </span>{" "}
                      is a computed disposition summary, not a record table —
                      the CRM's Overall Data tab derives these numbers live from
                      Accounts Mining, Leads, Meetings and Account status
                      changes. It is not imported directly; once the sheets
                      above are imported, Overall Data updates automatically.
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-40 rounded-lg border border-sky-200/70 bg-white">
                    <Table>
                      <TableHeader className="bg-sky-50/70">
                        <TableRow>
                          {overallDataSheet.parsed.headers
                            .slice(0, 8)
                            .map((h, i) => (
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
                        {overallDataSheet.parsed.rows
                          .slice(0, 5)
                          .map((r, i) => (
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

              {unrecognizedEntries.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4" /> Unrecognized Sheets —
                    not imported
                  </div>
                  {unrecognizedEntries.map((e) => (
                    <p key={e.sheetName} className="text-sm text-amber-700">
                      {e.sheetName} ({e.rowCount} rows) — sheet name didn't
                      match a supported CRM sheet.
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
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Sheet
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Created
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Updated
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Skipped
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500">
                        Failed
                      </TableHead>
                      <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">
                        View
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importableEntries.map((e) => (
                      <TableRow key={e.sheetName}>
                        <TableCell className="text-sm font-medium text-slate-700">
                          {e.sheetName}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {e.summary?.created ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {e.summary?.updated ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {e.summary?.skipped ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {e.summary?.failed ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {SHEET_ROUTE[e.kind] &&
                          (e.summary?.created || e.summary?.updated) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => {
                                handleClose(false);
                                navigate(SHEET_ROUTE[e.kind] as string);
                              }}
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </Button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {allErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-red-700">
                      {allErrors.length} row error
                      {allErrors.length === 1 ? "" : "s"} across this import
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs gap-1 text-red-700"
                      onClick={() =>
                        downloadErrorReport(
                          allErrors.map((message, i) => ({
                            rowNumber: i + 1,
                            message,
                          })),
                          "crm-bulk-import",
                        )
                      }
                    >
                      Download error report
                    </Button>
                  </div>
                  {allErrors.slice(0, 10).map((msg, i) => (
                    <p key={i} className="text-sm text-red-700">
                      {msg}
                    </p>
                  ))}
                  {allErrors.length > 10 && (
                    <p className="text-sm text-red-500">
                      …and {allErrors.length - 10} more
                    </p>
                  )}
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

      {reviewingKind && reviewingEntry && reviewingSheet && reviewingConfig && (
        <BulkImportDialog
          open={!!reviewingKind}
          onOpenChange={(o) => {
            if (!o) setReviewingKind(null);
          }}
          title={reviewingConfig.title}
          fields={reviewingConfig.fields}
          duplicate={reviewingConfig.duplicate}
          commitImport={wrappedCommit(reviewingKind)}
          fileBaseName={reviewingConfig.fileBaseName}
          initialParsed={reviewingSheet.parsed}
          initialFileName={fileName}
          initialMappingOverrides={reviewMappingOverrides}
        />
      )}
    </>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "blue" | "amber" | "red";
}) {
  const toneClass: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-xl border p-3 ${toneClass[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
