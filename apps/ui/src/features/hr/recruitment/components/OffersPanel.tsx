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
  Printer,
  Download,
  CheckCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useCreateOffer, useOffer, useOffers, useUpdateOffer } from "../hooks";
import type { CreateOfferLetterInput, OfferLetterView } from "../types";
import {
  apiErrorMessage,
  formatDate,
  formatRupees,
  useDebouncedValue,
} from "../utils";
import { monthlyTotal } from "../salary";
import type { OfferFormValues } from "../schema";
import { DetailList } from "./DetailList";
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
    };
  }, [formState]);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Offer Letter
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Generate and manage candidate offer letters with live document
            preview.
          </p>
        </div>

        {/* View Toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-800/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setEditingOffer(null);
              setActiveSubTab("generator");
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-theme-xs font-medium transition-colors ${
              activeSubTab === "generator"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            {editingOffer ? "Edit Offer" : "Generator & Preview"}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("history")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-theme-xs font-medium transition-colors ${
              activeSubTab === "history"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
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
          <div className="lg:col-span-6 xl:col-span-5">
            <Card className="p-5 md:p-6 shadow-theme-xs">
              <div className="mb-5 flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
                <div>
                  <h3 className="text-theme-base font-bold text-gray-900 dark:text-white/90">
                    Offer Details
                  </h3>
                  <p className="text-theme-xs text-gray-500">
                    Enter the offer terms and candidate compensation.
                  </p>
                </div>
                {editingOffer ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingOffer(null);
                      setFormState(emptyOfferValues());
                    }}
                    className="text-theme-xs"
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
                  }}
                  submitLabel="Save Changes"
                  onValuesChange={setFormState}
                />
              ) : (
                <OfferForm
                  key="new-offer"
                  onSubmit={handleCreate}
                  onCancel={() => setFormState(emptyOfferValues())}
                  submitLabel="Save Offer Letter"
                  onValuesChange={setFormState}
                />
              )}
            </Card>
          </div>

          {/* Right section — Live document preview */}
          <div className="lg:col-span-6 xl:col-span-7 sticky top-6">
            <Card className="p-4 md:p-6 shadow-theme-xs bg-gray-50/50 dark:bg-gray-900/40">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
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
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>

              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto rounded-xl p-1">
                <OfferLetterDocument
                  data={previewData}
                  onPrint={() => window.print()}
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
                    cell: (item) => (
                      <div className="flex flex-col">
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
                    cell: (item) => (
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {item.role}
                      </span>
                    ),
                  },
                  {
                    header: "Offer Date",
                    cell: (item) => (
                      <span className="text-theme-xs text-gray-700 dark:text-gray-300">
                        {formatDate(item.offerDate)}
                      </span>
                    ),
                  },
                  {
                    header: "Joining Date",
                    cell: (item) => (
                      <span className="text-theme-xs font-medium text-gray-800 dark:text-gray-200">
                        {formatDate(item.joiningDate)}
                      </span>
                    ),
                  },
                  {
                    header: "Gross Annual CTC",
                    cell: (item) => (
                      <span className="whitespace-nowrap font-bold text-gray-900 dark:text-white">
                        {formatRupees(item.grossAnnual)}
                      </span>
                    ),
                  },
                  {
                    header: "Status",
                    cell: (item) => (
                      <StatusBadge
                        label={
                          item.status === "GENERATED"
                            ? "Generated"
                            : item.status
                        }
                        colorToken="brand"
                      />
                    ),
                  },
                  {
                    header: "Actions",
                    className: "text-right",
                    cell: (item) => (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailId(item.id)}
                          aria-label={`View offer for ${item.candidateName}`}
                          className="inline-flex items-center gap-1 text-theme-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingOffer(item);
                              setFormState(offerValuesFrom(item));
                              setActiveSubTab("generator");
                            }}
                            aria-label={`Edit offer for ${item.candidateName}`}
                            className="inline-flex items-center gap-1 text-theme-xs"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
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
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
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
              onPrint={() => window.print()}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
