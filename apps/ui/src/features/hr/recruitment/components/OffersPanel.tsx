"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  FileText,
  List,
  Plus,
  Search,
  Eye,
  Edit2,
  Download,
  Mail,
  MessageCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useCreateOffer, useOffer, useOffers, useUpdateOffer } from "../hooks";
import type { CreateOfferLetterInput, OfferLetterView } from "../types";
import {
  apiErrorMessage,
  formatDate,
  formatRupees,
  printOfferLetter,
  useDebouncedValue,
} from "../utils";
import type { OfferFormValues } from "../schema";
import { monthlyTotal } from "../salary";
import { OfferForm, emptyOfferValues, offerValuesFrom } from "./OfferForm";
import {
  OfferLetterDocument,
  type OfferLetterDocumentData,
} from "./OfferLetterDocument";

const PAGE_SIZE = 10;

export interface OffersPanelProps {
  canWrite: boolean;
}

export function OffersPanel({ canWrite }: OffersPanelProps) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<"generator" | "history">(
    "generator",
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editingOffer, setEditingOffer] = useState<OfferLetterView | null>(
    null,
  );

  // Live state for document preview in Screen 3
  const [formState, setFormState] = useState<OfferFormValues>(() =>
    emptyOfferValues(),
  );

  const [signatureImageUrl, setSignatureImageUrl] = useState("");
  const [sealImageUrl, setSealImageUrl] = useState("");

  const debouncedSearch = useDebouncedValue(search.trim());
  const query = useOffers({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });
  const createMutation = useCreateOffer();
  const updateMutation = useUpdateOffer();
  const detail = useOffer(detailId ?? undefined);

  // Convert current form values into live preview document data
  const previewData: OfferLetterDocumentData = useMemo(() => {
    const mTotal = monthlyTotal(formState);
    return {
      candidateName: formState.candidateName,
      role: formState.role,
      location: formState.location,
      reportingManager: formState.reportingManager,
      offerDate: formState.offerDate,
      joiningDate: formState.joiningDate,
      offerValidityDate: formState.offerValidityDate,
      components: {
        basic: formState.basic,
        da: formState.da,
        hra: formState.hra,
        ca: formState.ca,
      },
      grossMonthly: mTotal,
      grossAnnual: mTotal * 12,
      workScheduleMonFri: formState.workScheduleMonFri,
      workScheduleSat: formState.workScheduleSat,
      workScheduleSun: formState.workScheduleSun,
      signatoryName: formState.signatoryName,
      signatoryDesignation: formState.signatoryDesignation,
      companyEmail: formState.companyEmail,
      companyPhone: formState.companyPhone,
      companyWebsite: formState.companyWebsite,
      companyAddress: formState.companyAddress,
      signatureImageUrl,
      sealImageUrl,
    };
  }, [formState, signatureImageUrl, sealImageUrl]);

  async function handleCreate(input: CreateOfferLetterInput) {
    await createMutation.mutateAsync(input);
    toast({ title: "Offer letter generated", variant: "success" });
    setFormState(emptyOfferValues());
    setActiveSubTab("history");
    setPage(1);
  }

  async function handleUpdate(input: CreateOfferLetterInput) {
    if (!editingOffer) return;
    await updateMutation.mutateAsync({ id: editingOffer.id, input });
    setEditingOffer(null);
    toast({ title: "Offer letter updated", variant: "success" });
  }

  function shareViaWhatsApp(item: OfferLetterView) {
    const candidate = item.candidateName || "Candidate";
    const roleName = item.role || "Position";
    const message = `Hello ${candidate}, Please find attached your Offer Letter for the position of ${roleName} at TexaWave Innovations Pvt Ltd.`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  function shareViaEmail(item: OfferLetterView) {
    const candidate = item.candidateName || "Candidate";
    const roleName = item.role || "Position";
    const subject = `Offer Letter - TexaWave Innovations (${candidate})`;
    const message = `Hello ${candidate},\n\nPlease find attached your Offer Letter for the position of ${roleName} at TexaWave Innovations Pvt Ltd.\n\nBest regards,\nTexaWave Innovations`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.open(gmailUrl, "_blank");
  }

  // Handle permission error as required by e2e test
  if (
    query.isError &&
    query.error instanceof ApiError &&
    query.error.isPermissionError
  ) {
    return (
      <Alert variant="warning" title="Access denied">
        You do not have permission to view offer letters.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200/90 pb-4 dark:border-gray-800 print:hidden">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Offer Letter Generator
          </h2>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Generate, customize, and issue official candidate offer letters with live document preview.
          </p>
        </div>

        {/* View Toggle */}
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50/80 p-1 dark:border-gray-800 dark:bg-gray-800/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setEditingOffer(null);
              setActiveSubTab("generator");
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-theme-xs font-semibold transition-all ${
              activeSubTab === "generator"
                ? "bg-white text-brand-600 shadow-xs dark:bg-gray-900 dark:text-cyan-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            {editingOffer ? "Edit Offer" : "Generator & Preview"}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("history")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-theme-xs font-semibold transition-all ${
              activeSubTab === "history"
                ? "bg-white text-brand-600 shadow-xs dark:bg-gray-900 dark:text-cyan-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Offer Letters ({query.data?.meta.total ?? 0})
          </button>
        </div>
      </div>

      {/* Screen 3 Workspace: Generator & Preview */}
      {activeSubTab === "generator" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left section — Offer details and configuration */}
          <div className="lg:col-span-6 xl:col-span-5 print:hidden">
            <Card className="p-5 md:p-6 shadow-theme-xs">
              <div className="mb-4 flex items-center justify-between border-b border-gray-200/90 pb-3 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-brand-500" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Offer Details & Configuration
                  </h3>
                </div>
                {editingOffer ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingOffer(null);
                      setFormState(emptyOfferValues());
                      setSignatureImageUrl("");
                      setSealImageUrl("");
                    }}
                    className="text-theme-xs text-gray-500 hover:text-gray-900"
                  >
                    Reset Form
                  </Button>
                ) : null}
              </div>

              {editingOffer ? (
                <OfferForm
                  key={`edit-${editingOffer.id}`}
                  initial={editingOffer}
                  onSubmit={handleUpdate}
                  onCancel={() => {
                    setEditingOffer(null);
                    setFormState(emptyOfferValues());
                    setSignatureImageUrl("");
                    setSealImageUrl("");
                  }}
                  submitLabel="Save Changes"
                  onValuesChange={setFormState}
                  signatureImageUrl={signatureImageUrl}
                  sealImageUrl={sealImageUrl}
                  onSignatureChange={setSignatureImageUrl}
                  onSealChange={setSealImageUrl}
                />
              ) : (
                <OfferForm
                  key="new-offer"
                  onSubmit={handleCreate}
                  onCancel={() => {
                    setFormState(emptyOfferValues());
                    setSignatureImageUrl("");
                    setSealImageUrl("");
                  }}
                  submitLabel="Save Offer Letter"
                  onValuesChange={setFormState}
                  signatureImageUrl={signatureImageUrl}
                  sealImageUrl={sealImageUrl}
                  onSignatureChange={setSignatureImageUrl}
                  onSealChange={setSealImageUrl}
                />
              )}
            </Card>
          </div>

          {/* Right section — Live document preview */}
          <div className="lg:col-span-6 xl:col-span-7 sticky top-6 print:static print:w-full print:block">
            <Card className="p-4 md:p-6 shadow-theme-xs bg-gray-50/50 dark:bg-gray-900/40 print:p-0 print:border-none print:shadow-none print:bg-white">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-800 print:hidden">
                <div>
                  <h3 className="text-theme-base font-bold text-gray-900 dark:text-white/90">
                    Document Preview
                  </h3>
                  <p className="text-theme-xs text-gray-500">
                    Live formatting preview conforming to TEXA letterhead.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => printOfferLetter()}
                  className="inline-flex items-center gap-1.5 self-start sm:self-auto text-brand-600 hover:text-brand-700 hover:bg-brand-50 border-brand-200"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>

              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto rounded-xl p-1 print:max-h-none print:overflow-visible print:p-0">
                <OfferLetterDocument
                  data={previewData}
                  onPrint={() => printOfferLetter()}
                />
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* History & Records Table */
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                type="search"
                aria-label="Search offer letters"
                placeholder="Search candidate or role..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            {canWrite ? (
              <Button
                onClick={() => {
                  setEditingOffer(null);
                  setActiveSubTab("generator");
                }}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                Generate offer
              </Button>
            ) : null}
          </div>

          {query.isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : query.data.data.length === 0 ? (
            <Card>
              <EmptyState
                title="No offer letters yet"
                description={
                  debouncedSearch
                    ? "No offer letters match this search."
                    : "Generated offer letters will appear here."
                }
              />
            </Card>
          ) : (
            <>
              <DataTable<OfferLetterView>
                caption="Generated offer letters"
                rows={query.data.data}
                getRowKey={(item) => String(item.id)}
                columns={[
                  {
                    header: "Candidate",
                    align: "center",
                    cell: (item) => (
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="font-semibold text-gray-900 dark:text-white/90">
                          {item.candidateName}
                        </span>
                        <span className="text-theme-xs text-gray-500">
                          {item.location}
                        </span>
                      </div>
                    ),
                  },
                  {
                    header: "Role / Position",
                    align: "center",
                    cell: (item) => (
                      <span className="block text-center font-medium text-gray-800 dark:text-gray-200">
                        {item.role}
                      </span>
                    ),
                  },
                  {
                    header: "Offer Date",
                    align: "center",
                    cell: (item) => (
                      <span className="block text-center text-theme-xs text-gray-700 dark:text-gray-300">
                        {formatDate(item.offerDate)}
                      </span>
                    ),
                  },
                  {
                    header: "Joining Date",
                    align: "center",
                    cell: (item) => (
                      <span className="block text-center text-theme-xs font-medium text-gray-800 dark:text-gray-200">
                        {formatDate(item.joiningDate)}
                      </span>
                    ),
                  },
                  {
                    header: "Gross Annual CTC",
                    align: "center",
                    cell: (item) => (
                      <span className="block text-center whitespace-nowrap font-bold text-gray-900 dark:text-white">
                        {formatRupees(item.grossAnnual)}
                      </span>
                    ),
                  },
                  {
                    header: "Status",
                    align: "center",
                    cell: (item) => (
                      <div className="flex items-center justify-center">
                        <StatusBadge
                          label={
                            item.status === "GENERATED"
                              ? "Generated"
                              : item.status
                          }
                          colorToken="brand"
                        />
                      </div>
                    ),
                  },
                  {
                    header: "Actions",
                    align: "center",
                    className: "text-center",
                    cell: (item) => (
                      <div className="flex justify-center items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailId(item.id)}
                          title="View Preview"
                          aria-label={`View offer for ${item.candidateName}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50/60 text-brand-600 shadow-2xs hover:bg-brand-50 hover:border-brand-400 hover:text-brand-700 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400 dark:hover:bg-brand-950/40 dark:hover:border-brand-500"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => shareViaWhatsApp(item)}
                          title="Share via WhatsApp"
                          aria-label={`Share via WhatsApp for ${item.candidateName}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/60 text-emerald-600 shadow-2xs hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:border-emerald-500"
                        >
                          <MessageCircle className="h-4.5 w-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => shareViaEmail(item)}
                          title="Share via Email"
                          aria-label={`Share via Email for ${item.candidateName}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50/60 text-sky-600 shadow-2xs hover:bg-sky-50 hover:border-sky-400 hover:text-sky-700 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-sky-400 dark:hover:bg-sky-950/40 dark:hover:border-sky-500"
                        >
                          <Mail className="h-4.5 w-4.5" />
                        </button>
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOffer(item);
                              setFormState(offerValuesFrom(item));
                              setActiveSubTab("generator");
                            }}
                            title="Edit Offer"
                            aria-label={`Edit offer for ${item.candidateName}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 text-slate-700 shadow-2xs hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750 dark:hover:border-gray-600 dark:hover:text-white"
                          >
                            <Edit2 className="h-4.5 w-4.5" />
                          </button>
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination
                page={query.data.meta.page}
                totalPages={query.data.meta.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Offer letter details"
        size="4xl"
      >
        {detail.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : detail.isError ? (
          <Alert variant="error" title="Could not load offer letter">
            {apiErrorMessage(detail.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <div className="flex flex-col gap-6">
            <OfferLetterDocument
              data={{
                candidateName: detail.data.candidateName,
                role: detail.data.role,
                location: detail.data.location,
                reportingManager: detail.data.reportingManager,
                offerDate: detail.data.offerDate,
                joiningDate: detail.data.joiningDate,
                offerValidityDate: detail.data.offerValidityDate,
                components: detail.data.components,
                grossMonthly: detail.data.grossMonthly,
                grossAnnual: detail.data.grossAnnual,
                workScheduleMonFri: detail.data.workSchedule.monFri,
                workScheduleSat: detail.data.workSchedule.sat,
                workScheduleSun: detail.data.workSchedule.sun,
                signatoryName: detail.data.signatoryName,
                signatoryDesignation: detail.data.signatoryDesignation,
                companyEmail: detail.data.companyEmail,
                companyPhone: detail.data.companyPhone,
                companyWebsite: detail.data.companyWebsite,
                companyAddress: detail.data.companyAddress,
              }}
              onPrint={() => printOfferLetter()}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
