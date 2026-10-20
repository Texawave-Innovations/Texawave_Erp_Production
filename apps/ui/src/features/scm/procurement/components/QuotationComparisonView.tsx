"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Scale } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { TextField } from "../../shared/form-bits";
import {
  formatDate,
  formatMoney,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { errorText } from "../../shared/use-list-controls";
import {
  useComparison,
  useRfqsWithQuotations,
  useSaveComparison,
} from "../hooks";

/** Legacy `ScmQuotationComparison`: supplier quotations for one RFQ side by
 * side. Lowest total and earliest delivery are highlighted as facts only —
 * choosing the winner is always a user decision. */
export function QuotationComparisonView() {
  const router = useRouter();
  const params = useSearchParams();
  const [rfqId, setRfqId] = useState<number | null>(
    params.get("rfqId") ? Number(params.get("rfqId")) : null,
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();
  const canDecide = usePermission("scm.procurement.approve");
  const canWrite = usePermission("scm.procurement.write");
  const rfqs = useRfqsWithQuotations();
  const comparison = useComparison(rfqId);
  const save = useSaveComparison();

  const quotations = useMemo(() => comparison.data ?? [], [comparison.data]);
  const decided = quotations.find((q) => q.status === "SELECTED") ?? null;
  const lowestId = quotations.length
    ? quotations.reduce((a, b) => (Number(b.total) < Number(a.total) ? b : a))
        .id
    : null;
  const earliestId = useMemo(() => {
    let best: { id: number; date: string } | null = null;
    for (const q of quotations) {
      const dates = q.items
        .map((i) => i.promisedDeliveryDate)
        .filter((d): d is string => Boolean(d))
        .sort();
      if (dates[0] && (!best || dates[0] < best.date))
        best = { id: q.id, date: dates[0] };
    }
    return best?.id ?? null;
  }, [quotations]);

  async function handleSave() {
    if (rfqId === null) return;
    try {
      await save.mutateAsync({
        rfqId,
        ...(selectedId !== null ? { selectedQuotationId: selectedId } : {}),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      });
      toast({ title: "Comparison saved", variant: "success" });
      setSelectedId(null);
    } catch (err) {
      toast({
        title: errorText(err, "Failed to save comparison"),
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={Scale}
        title="Quotation Comparison"
        description="Compare supplier quotations side by side for an RFQ. The system highlights factual differences only — selection is always made by an authorized user, never automated."
      />
      <div className="max-w-sm">
        <Select
          aria-label="RFQ"
          value={rfqId === null ? "" : String(rfqId)}
          onChange={(e) => {
            setRfqId(e.target.value ? Number(e.target.value) : null);
            setSelectedId(null);
          }}
        >
          <option value="">Select an RFQ with quotations</option>
          {(rfqs.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.rfqNumber}
            </option>
          ))}
        </Select>
      </div>

      {rfqId === null ? (
        <Card>
          <EmptyState
            title={
              rfqs.data?.length === 0
                ? "No RFQs have received supplier quotations yet."
                : "Select an RFQ to compare its supplier quotations."
            }
          />
        </Card>
      ) : comparison.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : comparison.isError ? (
        comparison.error instanceof ApiError &&
        comparison.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to procurement">
            Ask an administrator for the <code>scm.procurement.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void comparison.refetch()} />
        )
      ) : quotations.length === 0 ? (
        <Card>
          <EmptyState title="No quotations to compare for this RFQ" />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Quotations for the selected RFQ"
            rows={quotations}
            getRowKey={(q) => String(q.id)}
            columns={[
              {
                header: "",
                headerClassName: "w-10",
                cell: (q) =>
                  decided ||
                  !canDecide ||
                  !["RECEIVED", "SHORTLISTED"].includes(q.status) ? null : (
                    <input
                      type="radio"
                      name="selected-quotation"
                      aria-label={`Select ${q.quotationNumber}`}
                      checked={selectedId === q.id}
                      onChange={() => setSelectedId(q.id)}
                    />
                  ),
              },
              {
                header: "Supplier",
                cell: (q) => <strong>{q.vendorNameSnapshot}</strong>,
              },
              {
                header: "Quotation #",
                cell: (q) => (
                  <span className="font-mono text-theme-xs">
                    {q.quotationNumber}
                  </span>
                ),
              },
              {
                header: "Subtotal",
                align: "right",
                cell: (q) => formatMoney(q.subtotal, q.currency),
              },
              {
                header: "Tax",
                align: "right",
                cell: (q) => formatMoney(q.tax, q.currency),
              },
              {
                header: "Freight",
                align: "right",
                cell: (q) => formatMoney(q.freight, q.currency),
              },
              {
                header: "Total",
                align: "right",
                cell: (q) => (
                  <span className="inline-flex items-center gap-2">
                    {formatMoney(q.total, q.currency)}
                    {q.id === lowestId ? (
                      <StatusBadge label="Lowest" colorToken="success" />
                    ) : null}
                  </span>
                ),
              },
              { header: "Payment", cell: (q) => q.paymentTerms ?? "—" },
              {
                header: "Earliest Delivery",
                cell: (q) => {
                  const d = q.items
                    .map((i) => i.promisedDeliveryDate)
                    .filter((x): x is string => Boolean(x))
                    .sort()[0];
                  return (
                    <span className="inline-flex items-center gap-2">
                      {formatDate(d)}
                      {q.id === earliestId ? (
                        <StatusBadge label="Earliest" colorToken="brand" />
                      ) : null}
                    </span>
                  );
                },
              },
              { header: "Valid Until", cell: (q) => formatDate(q.validUntil) },
              {
                header: "Status",
                cell: (q) => (
                  <StatusBadge
                    label={formatStatusLabel(q.status)}
                    colorToken={scmStatusToken(q.status)}
                  />
                ),
              },
            ]}
          />
          <Card className="flex flex-col gap-3">
            {decided ? (
              <p className="text-theme-sm">
                <strong>{decided.quotationNumber}</strong> from{" "}
                {decided.vendorNameSnapshot} is selected for this RFQ.
              </p>
            ) : canDecide ? (
              <TextField
                label="Remarks"
                value={remarks}
                onChange={setRemarks}
                placeholder="Why this supplier (optional)"
              />
            ) : (
              <p className="text-theme-sm text-gray-500">
                Selecting a quotation needs the{" "}
                <code>scm.procurement.approve</code> permission.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {!decided && canDecide ? (
                <Button
                  onClick={() => void handleSave()}
                  loading={save.isPending}
                >
                  {selectedId === null
                    ? "Save comparison"
                    : "Select quotation & save"}
                </Button>
              ) : null}
              {decided && canWrite ? (
                <Button
                  onClick={() =>
                    router.push(
                      `/scm/procurement/purchase-orders?fromQuotation=${decided.id}`,
                    )
                  }
                >
                  Create PO from selected
                </Button>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
