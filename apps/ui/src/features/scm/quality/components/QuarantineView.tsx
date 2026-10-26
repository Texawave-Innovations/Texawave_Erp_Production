"use client";

import type { QuarantineRecord } from "@texawave-erp/api-types";
import { QUARANTINE_STATUSES } from "@texawave-erp/api-types";
import { Button, Select, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDate,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useDeleteQuarantine,
  useQuarantine,
  useQuarantineAction,
} from "../hooks";

/** Legacy `ScmQualityQuarantine`: stock held pending a quality decision. */
export function QuarantineView() {
  const c = useListControls();
  const [status, setStatus] = useState<
    (typeof QUARANTINE_STATUSES)[number] | ""
  >("");
  const [viewing, setViewing] = useState<QuarantineRecord | null>(null);
  const [acting, setActing] = useState<{
    row: QuarantineRecord;
    action: "release" | "reject";
  } | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.quality.write");
  const deletingRowRemove = useDeleteQuarantine();
  const [deletingRow, setDeletingRow] = useState<QuarantineRecord | null>(null);
  const canApprove = usePermission("scm.quality.approve");
  const act = useQuarantineAction();
  const query = useQuarantine({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  async function review(row: QuarantineRecord) {
    try {
      await act.mutateAsync({ id: row.id, action: "review" });
      toast({ title: "Marked under review", variant: "success" });
    } catch (err) {
      toast({ title: errorText(err, "Failed to update"), variant: "error" });
    }
  }

  return (
    <ScmListView<QuarantineRecord>
      title="Quarantine"
      description="Stock held out of sellable on-hand pending a release or write-off decision."
      icon={ShieldAlert}
      noun="quarantine records"
      readPermission="scm.quality.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={setViewing}
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by product, batch, serial or source...",
      }}
      filters={
        <div className="w-full lg:w-48">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(
                e.target.value as (typeof QUARANTINE_STATUSES)[number] | "",
              );
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {QUARANTINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
      }
      hasActiveFilters={Boolean(c.search || status)}
      onResetFilters={() => {
        c.setSearch("");
        setStatus("");
      }}
      emptyTitle="Nothing quarantined"
      emptyDescription="Stock lands here from a failed QC inspection or a return disposition."
      columns={[
        {
          header: "Product",
          cell: (r) => `${r.productName} (${r.productCode})`,
        },
        { header: "Batch", cell: (r) => r.batchNumber ?? "—" },
        { header: "Warehouse", cell: (r) => r.warehouse?.name ?? "—" },
        {
          header: "Quantity",
          align: "right",
          cell: (r) => formatQty(r.quantity),
        },
        {
          header: "Source",
          cell: (r) => r.inspectionNumber ?? r.sourceNumber ?? "—",
        },
        { header: "Quarantined", cell: (r) => formatDate(r.quarantineDate) },
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
          header: "Actions",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) => (
            <div
              className="flex flex-wrap justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {r.status === "QUARANTINED" && canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void review(r)}
                >
                  Review
                </Button>
              ) : null}
              {["QUARANTINED", "UNDER_REVIEW"].includes(r.status) &&
              canApprove ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActing({ row: r, action: "release" })}
                  >
                    Release
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActing({ row: r, action: "reject" })}
                  >
                    Write Off
                  </Button>
                </>
              ) : null}
            </div>
          ),
        },
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
                  label="Delete quarantine record"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<QuarantineRecord>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete quarantine record?"
        describe={(r) =>
          `Delete the quarantine record for ${r.productName}? This cannot be undone. A released or rejected record has already posted a stock ledger entry and cannot be deleted.`
        }
        confirmText="Delete record"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Quarantine record deleted"
        errorFallback="Failed to delete quarantine record"
      />
      <ScmFormDialog
        open={Boolean(acting)}
        onClose={() => setActing(null)}
        title={
          acting?.action === "release"
            ? "Release from Quarantine"
            : "Write Off (Reject)"
        }
        description={
          acting?.action === "release"
            ? "Posts QC_RELEASE and returns the quantity to sellable on-hand."
            : "Posts QC_REJECT — the stock is permanently written off."
        }
        submitLabel={acting?.action === "release" ? "Release" : "Write Off"}
        fields={[
          {
            name: "notes",
            label: "Notes (optional)",
            type: "textarea",
            span: 2,
          },
        ]}
        onSubmit={async (v) => {
          if (!acting) return;
          try {
            await act.mutateAsync({
              id: acting.row.id,
              action: acting.action,
              body: { notes: v.notes },
            });
          } catch (err) {
            throw new Error(errorText(err, "Action failed"));
          }
          toast({
            title:
              acting.action === "release"
                ? "Stock released"
                : "Stock written off",
            variant: "success",
          });
          setActing(null);
        }}
      />
      <ScmDetailDialog
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={
          viewing
            ? `${viewing.productName} (${viewing.productCode})`
            : "Quarantine"
        }
        status={viewing?.status ?? ""}
        fields={[
          ["Batch", viewing?.batchNumber],
          [
            "Serials",
            viewing?.serialNumbers.length
              ? viewing.serialNumbers.join(", ")
              : "—",
          ],
          ["Warehouse", viewing?.warehouse?.name],
          ["Quantity", viewing ? formatQty(viewing.quantity) : "—"],
          [
            "Source type",
            viewing ? formatStatusLabel(viewing.sourceType) : undefined,
          ],
          ["Source number", viewing?.sourceNumber],
          ["Inspection", viewing?.inspectionNumber],
          ["Defect code", viewing?.defectCode],
          ["Reason", viewing?.reason],
          ["Quarantined", formatDate(viewing?.quarantineDate)],
          ["Released", formatDate(viewing?.releasedAt)],
          ["Rejected", formatDate(viewing?.rejectedAt)],
          ["Notes", viewing?.notes],
        ]}
      />
    </ScmListView>
  );
}
