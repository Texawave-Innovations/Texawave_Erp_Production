"use client";

import type {
  QualityInspection,
  QualityInspectionStatus,
  QualityInspectionType,
} from "@texawave-erp/api-types";
import {
  INSPECTION_STATUSES,
  INSPECTION_TYPES,
  INSPECTION_TYPE_LABEL,
} from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { Plus, SearchCheck } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateInspection,
  useDeleteInspection,
  useInspection,
  useInspections,
} from "../hooks";
import { InspectionDetailDialog } from "./InspectionDetailDialog";
import { InspectionForm } from "./InspectionForm";

/** Legacy `ScmQualityInspections` / `ScmQualityInspectionDetail`. */
export function InspectionsView() {
  const c = useListControls();
  const [type, setType] = useState<QualityInspectionType | "">("");
  const [status, setStatus] = useState<QualityInspectionStatus | "">("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.quality.write");
  const deletingRowRemove = useDeleteInspection();
  const [deletingRow, setDeletingRow] = useState<QualityInspection | null>(
    null,
  );
  const create = useCreateInspection();
  const detail = useInspection(viewingId);
  const query = useInspections({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    inspectionType: type || undefined,
    status: status || undefined,
  });

  return (
    <ScmListView<QualityInspection>
      title="QC Inspections"
      description="Incoming, customer return, inventory and pre-dispatch quality inspections."
      icon={SearchCheck}
      noun="inspections"
      readPermission="scm.quality.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={(r) => setViewingId(r.id)}
      actions={
        canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Inspection
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by number, source, supplier or customer...",
      }}
      filters={
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
          <div className="w-full lg:w-48">
            <Select
              aria-label="Filter by type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as QualityInspectionType | "");
                c.setPage(1);
              }}
            >
              <option value="">All types</option>
              {INSPECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INSPECTION_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full lg:w-48">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as QualityInspectionStatus | "");
                c.setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {INSPECTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      }
      hasActiveFilters={Boolean(c.search || type || status)}
      onResetFilters={() => {
        c.setSearch("");
        setType("");
        setStatus("");
      }}
      emptyTitle="No QC inspections yet"
      emptyDescription="Create an inspection against a GRN, return, fulfillment or inventory."
      columns={[
        {
          header: "Inspection #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">
              {r.inspectionNumber}
            </span>
          ),
        },
        {
          header: "Type",
          cell: (r) => INSPECTION_TYPE_LABEL[r.inspectionType],
        },
        { header: "Source", cell: (r) => r.sourceNumber ?? r.sourceId },
        {
          header: "Party",
          cell: (r) => r.supplierName ?? r.customerName ?? "—",
        },
        { header: "Inspector", cell: (r) => r.inspectorName ?? "—" },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        {
          header: "Result",
          cell: (r) =>
            r.result ? (
              <StatusBadge
                label={formatStatusLabel(r.result)}
                colorToken={scmStatusToken(r.result)}
              />
            ) : (
              "—"
            ),
        },
        { header: "Date", cell: (r) => formatDate(r.inspectionDate) },
        {
          header: "",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) =>
            canWrite ? (
              <div
                className="flex justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <ScmDeleteButton
                  label="Delete inspection"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<QualityInspection>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete inspection?"
        describe={(r) =>
          `Permanently delete ${r.inspectionNumber}? This cannot be undone. A completed inspection has already posted ledger/quarantine entries and cannot be deleted.`
        }
        confirmText="Delete inspection"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Inspection deleted"
        errorFallback="Failed to delete inspection"
      />
      <InspectionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (input) => {
          let created: QualityInspection;
          try {
            created = await create.mutateAsync(input);
          } catch (err) {
            throw new Error(errorText(err, "Failed to create inspection"));
          }
          toast({
            title: `${created.inspectionNumber} created`,
            variant: "success",
          });
          setFormOpen(false);
          setViewingId(created.id);
        }}
      />
      <InspectionDetailDialog
        insp={detail.data ?? null}
        onClose={() => setViewingId(null)}
      />
    </ScmListView>
  );
}
