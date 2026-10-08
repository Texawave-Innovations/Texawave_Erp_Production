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
import { useState } from "react";
import { useCreateOffer, useOffer, useOffers, useUpdateOffer } from "../hooks";
import type { CreateOfferLetterInput, OfferLetterView } from "../types";
import {
  apiErrorMessage,
  formatDate,
  formatRupees,
  useDebouncedValue,
} from "../utils";
import { DetailList } from "./DetailList";
import { OfferForm } from "./OfferForm";

const PAGE_SIZE = 10;

export interface OffersPanelProps {
  canWrite: boolean;
}

export function OffersPanel({ canWrite }: OffersPanelProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const query = useOffers({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });
  const createMutation = useCreateOffer();
  const updateMutation = useUpdateOffer();
  const detail = useOffer(detailId ?? undefined);
  const editTarget = useOffer(editId ?? undefined);

  async function handleCreate(input: CreateOfferLetterInput) {
    await createMutation.mutateAsync(input);
    setCreateOpen(false);
    setPage(1);
    toast({ title: "Offer letter generated", variant: "success" });
  }

  async function handleUpdate(input: CreateOfferLetterInput) {
    if (editId === null) return;
    await updateMutation.mutateAsync({ id: editId, input });
    setEditId(null);
    toast({ title: "Offer letter updated", variant: "success" });
  }

  let body: React.ReactNode;
  if (query.isPending) {
    body = (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (query.isError) {
    body =
      query.error instanceof ApiError && query.error.isPermissionError ? (
        <Alert variant="warning" title="Access denied">
          You do not have permission to view offer letters.
        </Alert>
      ) : (
        <ErrorState onRetry={() => void query.refetch()} />
      );
  } else {
    const rows = query.data.data;
    const meta = query.data.meta;
    body =
      rows.length === 0 ? (
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
            rows={rows}
            getRowKey={(item) => String(item.id)}
            columns={[
              {
                header: "Candidate",
                cell: (item) => (
                  <span className="font-medium text-gray-900 dark:text-white/90">
                    {item.candidateName}
                  </span>
                ),
              },
              { header: "Role", cell: (item) => item.role },
              {
                header: "Offer date",
                cell: (item) => formatDate(item.offerDate),
              },
              {
                header: "Joining date",
                cell: (item) => formatDate(item.joiningDate),
              },
              {
                header: "Gross annual CTC",
                cell: (item) => (
                  <span className="whitespace-nowrap font-medium">
                    {formatRupees(item.grossAnnual)}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (item) => (
                  <StatusBadge
                    label={
                      item.status === "GENERATED" ? "Generated" : item.status
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
                    >
                      View
                    </Button>
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditId(item.id)}
                        aria-label={`Edit offer for ${item.candidateName}`}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
          />
        </>
      );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Offer letters
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Generate offer letters and keep their terms up to date.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setCreateOpen(true)}>Generate offer</Button>
        ) : null}
      </div>

      <Input
        type="search"
        aria-label="Search offer letters"
        placeholder="Search candidate or role"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="md:max-w-md"
      />

      {body}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Generate offer letter"
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <OfferForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Generate offer"
        />
      </Dialog>

      <Dialog
        open={editId !== null}
        onClose={() => setEditId(null)}
        title="Edit offer letter"
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {editTarget.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : editTarget.isError ? (
          <Alert variant="error" title="Could not load offer letter">
            {apiErrorMessage(editTarget.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <OfferForm
            key={editTarget.data.id}
            initial={editTarget.data}
            onSubmit={handleUpdate}
            onCancel={() => setEditId(null)}
            submitLabel="Save changes"
          />
        )}
      </Dialog>

      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Offer letter details"
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {detail.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : detail.isError ? (
          <Alert variant="error" title="Could not load offer letter">
            {apiErrorMessage(detail.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <div className="flex flex-col gap-5">
            <DetailList
              items={[
                { label: "Candidate", value: detail.data.candidateName },
                { label: "Role", value: detail.data.role },
                { label: "Location", value: detail.data.location },
                {
                  label: "Reporting manager",
                  value: detail.data.reportingManager || "—",
                },
                {
                  label: "Offer date",
                  value: formatDate(detail.data.offerDate),
                },
                {
                  label: "Joining date",
                  value: formatDate(detail.data.joiningDate),
                },
                {
                  label: "Offer valid until",
                  value: formatDate(detail.data.offerValidityDate),
                },
                { label: "Status", value: "Generated" },
              ]}
            />
            <DetailList
              items={[
                {
                  label: "Basic",
                  value: formatRupees(detail.data.components.basic),
                },
                { label: "DA", value: formatRupees(detail.data.components.da) },
                {
                  label: "HRA",
                  value: formatRupees(detail.data.components.hra),
                },
                { label: "CA", value: formatRupees(detail.data.components.ca) },
                {
                  label: "Gross monthly",
                  value: formatRupees(detail.data.grossMonthly),
                },
                {
                  label: "Gross annual CTC",
                  value: formatRupees(detail.data.grossAnnual),
                },
              ]}
            />
            <DetailList
              items={[
                {
                  label: "Mon – Fri",
                  value: detail.data.workSchedule.monFri,
                },
                { label: "Saturday", value: detail.data.workSchedule.sat },
                { label: "Sunday", value: detail.data.workSchedule.sun },
                {
                  label: "Signatory",
                  value: `${detail.data.signatoryName}, ${detail.data.signatoryDesignation}`,
                },
                { label: "Company e-mail", value: detail.data.companyEmail },
                { label: "Company phone", value: detail.data.companyPhone },
                { label: "Company website", value: detail.data.companyWebsite },
                { label: "Company address", value: detail.data.companyAddress },
              ]}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
