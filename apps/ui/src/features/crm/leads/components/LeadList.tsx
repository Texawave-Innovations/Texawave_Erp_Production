"use client";

import type { Lead } from "@texawave-erp/api-types";
import {
  LEAD_STATUSES,
  ApiError,
  type CreateLeadFormValues,
} from "@texawave-erp/core";
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
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { ConvertLeadDialog } from "./ConvertLeadDialog";
import { LeadForm } from "./LeadForm";
import {
  useCreateLead,
  useDeleteLead,
  useLeads,
  useUpdateLead,
} from "../hooks";

const PAGE_SIZE = 20;

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  NEW: "brand",
  CONTACTED: "gray",
  INTERESTED: "success",
  NOT_INTERESTED: "gray",
  FOLLOW_UP: "warning",
  MEETING_PENDING: "warning",
  QUALIFIED: "success",
  CONVERTED: "success",
  LOST: "error",
};

/** Reproduces legacy Leads.tsx: search across company/prospect/email/phone,
 * a status filter, the core table columns (Company, Prospect, Status,
 * Owner, Source, Converted-to, Action), and a Convert action that opens
 * `ConvertLeadDialog`. Advanced filters (rating/touched/last-activity),
 * which legacy derives from CRM-wide audit/activity feeds that don't exist
 * in production yet, are deferred — see Docs/CRM_LEGACY_PARITY.md. */
export function LeadList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [converting, setConverting] = useState<Lead | null>(null);
  const { toast } = useToast();

  const query = useLeads({
    page,
    limit: PAGE_SIZE,
    q: search || undefined,
    leadStatus: (statusFilter as (typeof LEAD_STATUSES)[number]) || undefined,
  });
  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const deleteMutation = useDeleteLead();

  async function handleCreate(values: CreateLeadFormValues) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({ title: "Lead created", variant: "success" });
  }

  async function handleUpdate(values: CreateLeadFormValues) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input: values });
    setEditing(null);
    toast({ title: "Lead updated", variant: "success" });
  }

  async function handleDelete(lead: Lead) {
    try {
      await deleteMutation.mutateAsync(lead.id);
      toast({ title: `Deleted "${lead.companyName}"`, variant: "success" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : `Could not delete "${lead.companyName}"`;
      toast({ title: message, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Leads
        </h1>
        <Button onClick={() => setCreateOpen(true)}>Add Lead</Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search company, prospect, email, phone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <div className="w-56">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to CRM leads">
            Ask an administrator for the <code>crm.lead.read</code> permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No leads yet"
            description="Create your first lead to see it here."
          />
        </Card>
      ) : (
        <>
          <DataTable<Lead>
            columns={[
              { header: "Company", cell: (l) => l.companyName },
              { header: "Prospect", cell: (l) => l.prospectName },
              {
                header: "Status",
                cell: (l) => (
                  <StatusBadge
                    label={l.leadStatus.replace(/_/g, " ")}
                    colorToken={STATUS_COLOR[l.leadStatus] ?? "gray"}
                  />
                ),
              },
              { header: "Owner", cell: (l) => l.assignedTo ?? "—" },
              { header: "Source", cell: (l) => l.leadSource ?? "—" },
              {
                header: "Converted To",
                cell: (l) => l.linkedAccount?.name ?? "—",
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (l) => (
                  <div className="flex justify-end gap-2">
                    {!l.linkedAccountId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConverting(l)}
                        aria-label={`Convert ${l.companyName}`}
                      >
                        Convert
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(l)}
                      aria-label={`Edit ${l.companyName}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(l)}
                      aria-label={`Delete ${l.companyName}`}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={query.data.data}
            getRowKey={(l) => String(l.id)}
          />
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New lead"
      >
        <LeadForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create lead"
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit lead"
      >
        {editing ? (
          <LeadForm
            initialValues={{
              companyName: editing.companyName,
              prospectName: editing.prospectName,
              domain: editing.domain ?? undefined,
              hq: editing.hq ?? undefined,
              industry: editing.industry ?? undefined,
              numberOfEmployees: editing.numberOfEmployees ?? undefined,
              title: editing.title ?? undefined,
              contactNumber: editing.contactNumber ?? undefined,
              email: editing.email ?? undefined,
              leadStatus: editing.leadStatus,
              priority:
                (editing.priority as "High" | "Medium" | "Low" | undefined) ??
                undefined,
              assignedTo: editing.assignedTo ?? undefined,
              leadSource: editing.leadSource ?? undefined,
              addressStreet: editing.addressStreet ?? undefined,
              city: editing.city ?? undefined,
              state: editing.state ?? undefined,
              country: editing.country ?? undefined,
              areaOfInterest: editing.areaOfInterest ?? undefined,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        ) : null}
      </Dialog>

      <Dialog
        open={converting !== null}
        onClose={() => setConverting(null)}
        title="Convert lead"
      >
        {converting ? (
          <ConvertLeadDialog
            key={converting.id}
            lead={converting}
            onConverted={() => {
              setConverting(null);
              toast({ title: "Lead converted", variant: "success" });
            }}
            onCancel={() => setConverting(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
