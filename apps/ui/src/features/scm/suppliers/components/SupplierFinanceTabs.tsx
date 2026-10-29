"use client";

import type {
  CreateSupplierBillInput,
  PurchaseOrder,
  SupplierBill,
  SupplierDocument,
  SupplierPayment,
  SupplierPaymentMode,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatCard,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Download, Eye, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import { useMasterListItems } from "../../master-list-items/hooks";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import {
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
  TotalsBar,
} from "../../shared/form-bits";
import { scmGet } from "../../shared/scm-api";
import { errorText } from "../../shared/use-list-controls";
import { ScmPanel } from "../../shared/ScmPanel";
import { fetchSupplierDocument } from "../finance-api";
import {
  useCancelSupplierBill,
  usePostSupplierBillToFinance,
  useCreateSupplierBill,
  useCreateSupplierPayment,
  useRemoveSupplierDocument,
  useSupplierBills,
  useSupplierDocuments,
  useSupplierFinanceSummary,
  useSupplierPayments,
  useUpdateSupplierBill,
  useUploadSupplierDocument,
  useVoidSupplierPayment,
} from "../finance-hooks";
import { useSupplierProcurement } from "../hooks";

const PAGE_SIZE = 10;
const today = () => new Date().toISOString().slice(0, 10);
const dateOnly = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10) : "";

const PAYMENT_MODES: ReadonlyArray<{
  value: SupplierPaymentMode;
  label: string;
}> = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];
const modeLabel = (m: string) =>
  PAYMENT_MODES.find((o) => o.value === m)?.label ?? formatStatusLabel(m);

const typeLabel = (t: string | null) => (t ? formatStatusLabel(t) : "—");

const statusLabel = (b: Pick<SupplierBill, "status" | "overdue">) =>
  b.overdue ? "Overdue" : formatStatusLabel(b.status);
const statusToken = (b: Pick<SupplierBill, "status" | "overdue">) =>
  b.overdue
    ? "error"
    : b.status === "PAID"
      ? "success"
      : scmStatusToken(b.status);

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function TabError({
  error,
  permission,
  noun,
  onRetry,
}: {
  error: unknown;
  permission: string;
  noun: string;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.isPermissionError) {
    return (
      <Alert variant="warning" title={`You don't have access to ${noun}`}>
        Ask an administrator for the <code>{permission}</code> permission.
      </Alert>
    );
  }
  return <ErrorState onRetry={onRetry} />;
}

/** Small "why?" dialog shared by bill cancellation and payment voiding. */
function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } catch (err) {
      setError(errorText(err, "Could not complete this action"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      {open ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
          <TextAreaField
            label="Reason"
            required
            value={reason}
            onChange={setReason}
            error={error ?? undefined}
            disabled={busy}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Back
            </Button>
            <Button type="submit" variant="destructive" loading={busy}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

function BillDialog({
  open,
  onClose,
  supplierId,
  currency,
  bill,
}: {
  open: boolean;
  onClose: () => void;
  supplierId: number;
  currency: string;
  bill: SupplierBill | null;
}) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title={bill ? `Edit ${bill.billNumber}` : "New Supplier Bill"}
      size="xl"
    >
      {open ? (
        <BillForm
          key={bill?.id ?? "new"}
          onClose={onClose}
          supplierId={supplierId}
          currency={currency}
          bill={bill}
        />
      ) : null}
    </ScmPanel>
  );
}

function BillForm({
  onClose,
  supplierId,
  currency,
  bill,
}: {
  onClose: () => void;
  supplierId: number;
  currency: string;
  bill: SupplierBill | null;
}) {
  const { toast } = useToast();
  const procurement = useSupplierProcurement(supplierId);
  const create = useCreateSupplierBill();
  const update = useUpdateSupplierBill();
  const [poId, setPoId] = useState(
    bill?.purchaseOrderId ? String(bill.purchaseOrderId) : "",
  );
  const [grnId, setGrnId] = useState(
    bill?.goodsReceiptId ? String(bill.goodsReceiptId) : "",
  );
  const [invoiceNo, setInvoiceNo] = useState(bill?.supplierBillNumber ?? "");
  const [billDate, setBillDate] = useState(dateOnly(bill?.billDate) || today());
  const [dueDate, setDueDate] = useState(dateOnly(bill?.dueDate));
  const [subtotal, setSubtotal] = useState(
    bill ? String(Number(bill.subtotal)) : "",
  );
  const [tax, setTax] = useState(bill ? String(Number(bill.taxAmount)) : "");
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = bill !== null;

  const pos = procurement.data?.purchaseOrders ?? [];
  const grns = (procurement.data?.receipts ?? []).filter((r) => {
    if (!poId) return true;
    const po = pos.find((p) => String(p.id) === poId);
    return !po || r.poNumber === po.poNumber;
  });

  /** Picking a PO pre-fills the amounts from it (still editable — a supplier
   * invoice rarely matches the PO to the paisa). */
  async function pickPo(value: string) {
    setPoId(value);
    setGrnId("");
    if (!value || editing) return;
    try {
      const po = await scmGet<PurchaseOrder>(
        `/scm/procurement/purchase-orders/${value}`,
      );
      const net =
        Number(po.subtotal) + Number(po.freight) - Number(po.discount);
      setSubtotal(String(Math.round(net * 100) / 100));
      setTax(String(Number(po.taxAmount)));
    } catch {
      // Leave the amounts for the user to type.
    }
  }

  const subtotalN = Number(subtotal || 0);
  const taxN = Number(tax || 0);
  const total = Math.round((subtotalN + taxN) * 100) / 100;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!billDate) found.billDate = "Bill date is required";
    if (!(subtotalN >= 0) || subtotal === "")
      found.subtotal = "Enter the bill amount";
    if (taxN < 0) found.tax = "Tax cannot be negative";
    if (subtotal !== "" && !(total > 0))
      found.subtotal = "The bill total must be greater than zero";
    if (dueDate && billDate && dueDate < billDate)
      found.dueDate = "Due date cannot be before the bill date";
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setBusy(true);
    try {
      if (bill) {
        await update.mutateAsync({
          id: bill.id,
          input: {
            supplierBillNumber: invoiceNo,
            billDate,
            ...(dueDate ? { dueDate } : {}),
            subtotal: subtotalN,
            taxAmount: taxN,
            notes,
          },
        });
        toast({ title: "Bill updated", variant: "success" });
      } else {
        const input: CreateSupplierBillInput = {
          supplierId,
          billDate,
          subtotal: subtotalN,
          taxAmount: taxN,
          ...(invoiceNo.trim() ? { supplierBillNumber: invoiceNo.trim() } : {}),
          ...(poId ? { purchaseOrderId: Number(poId) } : {}),
          ...(grnId ? { goodsReceiptId: Number(grnId) } : {}),
          ...(dueDate ? { dueDate } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
        const created = await create.mutateAsync(input);
        toast({
          title: `Bill ${created.billNumber} recorded`,
          variant: "success",
        });
      }
      onClose();
    } catch (err) {
      setSubmitError(errorText(err, "Could not save the bill"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormGrid>
        <SelectField
          label="Purchase order"
          value={poId}
          onChange={(v) => void pickPo(v)}
          options={pos.map((p) => ({
            value: String(p.id),
            label: `${p.poNumber} · ${formatMoney(p.total, p.currency, 0)}`,
          }))}
          placeholder="Not linked to a PO"
          hint="Pre-fills the amounts from the PO."
          disabled={busy || editing}
        />
        <SelectField
          label="Goods receipt"
          value={grnId}
          onChange={setGrnId}
          options={grns.map((g) => ({
            value: String(g.id),
            label: `${g.grnNumber} · ${formatDate(g.receiptDate)}`,
          }))}
          placeholder="Not linked to a GRN"
          disabled={busy || editing}
        />
        <TextField
          label="Supplier invoice no."
          value={invoiceNo}
          onChange={setInvoiceNo}
          placeholder="Number on the supplier's invoice"
          hint="Used to stop the same invoice being booked twice."
          disabled={busy}
        />
        <div />
        <TextField
          label="Bill date"
          type="date"
          required
          value={billDate}
          onChange={setBillDate}
          error={errors.billDate}
          disabled={busy}
        />
        <TextField
          label="Due date"
          type="date"
          value={dueDate}
          onChange={setDueDate}
          error={errors.dueDate}
          hint="Left blank, it is worked out from the supplier's payment terms."
          disabled={busy}
        />
        <TextField
          label={`Amount before tax (${currency})`}
          type="number"
          required
          min={0}
          step={0.01}
          value={subtotal}
          onChange={setSubtotal}
          error={errors.subtotal}
          disabled={busy}
        />
        <TextField
          label={`Tax (${currency})`}
          type="number"
          min={0}
          step={0.01}
          value={tax}
          onChange={setTax}
          error={errors.tax}
          disabled={busy}
        />
      </FormGrid>
      <TextAreaField
        label="Notes"
        value={notes}
        onChange={setNotes}
        disabled={busy}
      />
      <TotalsBar
        rows={[
          {
            label: "Amount before tax",
            value: formatMoney(subtotalN, currency),
          },
          { label: "Tax", value: formatMoney(taxN, currency) },
          {
            label: "Bill total",
            value: formatMoney(total, currency),
            strong: true,
          },
        ]}
      />
      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {submitError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {editing ? "Save changes" : "Record bill"}
        </Button>
      </div>
    </form>
  );
}

function PostBillDialog({
  open,
  bill,
  onClose,
  onSuccess,
}: {
  open: boolean;
  bill: SupplierBill | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isItcEligible, setIsItcEligible] = useState(true);
  const [jurisdiction, setJurisdiction] = useState<
    "AUTO" | "INTRA_STATE" | "INTER_STATE"
  >("AUTO");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postMutation = usePostSupplierBillToFinance();
  const queryClient = useQueryClient();

  if (!bill) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bill) return;
    setBusy(true);
    setError(null);
    try {
      const payload: {
        isItcEligible: boolean;
        jurisdiction?: "INTRA_STATE" | "INTER_STATE";
        notes?: string;
      } = {
        isItcEligible,
        ...(jurisdiction !== "AUTO" ? { jurisdiction } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      await postMutation.mutateAsync({ id: bill.id, input: payload });
      void queryClient.invalidateQueries({ queryKey: ["gst"] });
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      onSuccess();
      onClose();
    } catch (err) {
      setError(errorText(err, "Failed to post bill to Finance"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Post to Finance — ${bill.billNumber}`}
      size="md"
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert variant="error" title={error} /> : null}

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 space-y-2 text-theme-xs text-slate-700 dark:text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-500">Supplier:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {bill.supplier?.companyName}
            </span>
          </div>
          {bill.supplierBillNumber ? (
            <div className="flex justify-between">
              <span className="text-slate-500">Vendor Invoice #:</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {bill.supplierBillNumber}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-slate-500">Taxable Subtotal:</span>
            <span>{formatMoney(bill.subtotal, bill.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tax Amount:</span>
            <span>{formatMoney(bill.taxAmount, bill.currency)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
            <span>Total Payable:</span>
            <span>{formatMoney(bill.total, bill.currency)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-theme-xs font-medium text-slate-700 dark:text-slate-300">
            GST Jurisdiction
          </label>
          <select
            className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-theme-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={jurisdiction}
            onChange={(e) =>
              setJurisdiction(
                e.target.value as "AUTO" | "INTRA_STATE" | "INTER_STATE",
              )
            }
            disabled={busy}
          >
            <option value="AUTO">
              Auto-detect from Supplier & Company GSTIN
            </option>
            <option value="INTRA_STATE">
              Intra-State Supply (CGST + SGST)
            </option>
            <option value="INTER_STATE">Inter-State Supply (IGST)</option>
          </select>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <input
            type="checkbox"
            id="itc-eligible-checkbox"
            checked={isItcEligible}
            onChange={(e) => setIsItcEligible(e.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex flex-col">
            <label
              htmlFor="itc-eligible-checkbox"
              className="text-theme-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              Eligible for Input Tax Credit (ITC)
            </label>
            <span className="text-theme-xs text-slate-500 dark:text-slate-400">
              Uncheck if credit is blocked under Section 17(5) (e.g. motor
              vehicles, personal consumption). Ineligible tax is absorbed
              directly into the expense cost.
            </span>
          </div>
        </div>

        <TextAreaField
          label="Narration / Notes"
          placeholder="Optional notes for GL journal entry..."
          value={notes}
          onChange={setNotes}

          disabled={busy}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Post to Finance
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function SupplierBillsTab({
  supplierId,
  currency,
}: {
  supplierId: number;
  currency: string;
}) {
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierBill | null>(null);
  const [paying, setPaying] = useState<SupplierBill | null>(null);
  const [cancelling, setCancelling] = useState<SupplierBill | null>(null);
  const [posting, setPosting] = useState<SupplierBill | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.finance.write");
  const query = useSupplierBills({ supplierId, page, limit: PAGE_SIZE });
  const summary = useSupplierFinanceSummary(supplierId);
  const cancel = useCancelSupplierBill();

  if (query.isPending) return <Skeleton className="h-48 w-full" />;
  if (query.isError) {
    return (
      <TabError
        error={query.error}
        permission="scm.finance.read"
        noun="supplier bills"
        onRetry={() => void query.refetch()}
      />
    );
  }
  const s = summary.data;
  const bills = query.data.data;
  const meta = query.data.meta;

  return (
    <div className="flex flex-col gap-4">
      {s ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            headingId="bills-billed"
            label="Total billed"
            value={formatMoney(s.totalBilled, currency, 0)}
            note={`${s.billCount} bill(s)`}
          />
          <StatCard
            headingId="bills-paid"
            label="Paid"
            value={formatMoney(s.totalPaid, currency, 0)}
            note={`${s.paymentCount} payment(s)`}
            tone="success"
          />
          <StatCard
            headingId="bills-outstanding"
            label="Outstanding"
            value={formatMoney(s.outstanding, currency, 0)}
            note={`${s.openBillCount} open bill(s)`}
            tone="warning"
          />
          <StatCard
            headingId="bills-overdue"
            label="Overdue"
            value={formatMoney(s.overdueAmount, currency, 0)}
            note={
              s.overdueCount
                ? `${s.overdueCount} bill(s) past due`
                : "Nothing overdue"
            }
            tone={s.overdueCount ? "error" : "neutral"}
          />
        </div>
      ) : null}

      {canWrite ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Bill
          </Button>
        </div>
      ) : null}

      {bills.length === 0 ? (
        <Card>
          <EmptyState
            title="No supplier bills yet"
            description="Record the invoices this supplier sends — optionally against a purchase order or goods receipt — then pay them from here."
          />
        </Card>
      ) : (
        <DataTable<SupplierBill>
          caption="Supplier bills"
          rows={bills}
          getRowKey={(b) => String(b.id)}
          columns={[
            {
              header: "Bill #",
              cell: (b) => (
                <div className="flex flex-col">
                  <span className="font-medium text-theme-xs">
                    {b.billNumber}
                  </span>
                  {b.supplierBillNumber ? (
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      Inv {b.supplierBillNumber}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              header: "PO / GRN",
              cell: (b) =>
                b.purchaseOrder?.poNumber ?? b.goodsReceipt?.grnNumber ?? "—",
            },
            { header: "Bill date", cell: (b) => formatDate(b.billDate) },
            {
              header: "Due",
              cell: (b) => (
                <span
                  className={
                    b.overdue
                      ? "font-medium text-error-600 dark:text-error-400"
                      : undefined
                  }
                >
                  {formatDate(b.dueDate)}
                </span>
              ),
            },
            {
              header: "Total",
              align: "right",
              cell: (b) => formatMoney(b.total, b.currency),
            },
            {
              header: "Paid",
              align: "right",
              cell: (b) => formatMoney(b.paidAmount, b.currency),
            },
            {
              header: "Outstanding",
              align: "right",
              cell: (b) => formatMoney(b.outstanding, b.currency),
            },
            {
              header: "Status",
              cell: (b) => (
                <div className="flex flex-col gap-1 items-start">
                  <StatusBadge
                    label={statusLabel(b)}
                    colorToken={statusToken(b)}
                  />
                  {b.isPosted ? (
                    <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      GL Posted
                    </span>
                  ) : b.status !== "CANCELLED" ? (
                    <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      Unposted
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              header: "Actions",
              headerClassName: "text-right",
              className: "text-right",
              cell: (b) =>
                canWrite &&
                (b.status === "OPEN" || b.status === "PARTIALLY_PAID") ? (
                  <div className="flex justify-end gap-1">
                    {!b.isPosted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPosting(b)}
                      >
                        Post
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPaying(b)}
                    >
                      Pay
                    </Button>
                    {b.status === "OPEN" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(b);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancelling(b)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null,
            },
          ]}
        />
      )}
      {meta && meta.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      ) : null}

      <BillDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supplierId={supplierId}
        currency={currency}
        bill={editing}
      />
      <PaymentDialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        supplierId={supplierId}
        currency={currency}
        presetBill={paying}
      />
      <PostBillDialog
        open={posting !== null}
        bill={posting}
        onClose={() => setPosting(null)}
        onSuccess={() => {
          if (posting) {
            toast({
              title: `${posting.billNumber} posted to Finance & GST`,
              variant: "success",
            });
          }
        }}
      />
      <ReasonDialog
        open={cancelling !== null}
        title={cancelling ? `Cancel ${cancelling.billNumber}` : "Cancel bill"}
        description="A cancelled bill no longer counts as payable and its invoice number can be booked again."
        confirmLabel="Cancel bill"
        onClose={() => setCancelling(null)}
        onConfirm={async (reason) => {
          if (!cancelling) return;
          await cancel.mutateAsync({ id: cancelling.id, reason });
          toast({
            title: `${cancelling.billNumber} cancelled`,
            variant: "success",
          });
          setCancelling(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

function PaymentDialog({
  open,
  onClose,
  supplierId,
  currency,
  presetBill,
}: {
  open: boolean;
  onClose: () => void;
  supplierId: number;
  currency: string;
  presetBill: SupplierBill | null;
}) {
  return (
    <ScmPanel open={open} onClose={onClose} title="Record Payment" size="lg">
      {open ? (
        <PaymentForm
          key={presetBill?.id ?? "any"}
          onClose={onClose}
          supplierId={supplierId}
          currency={currency}
          presetBill={presetBill}
        />
      ) : null}
    </ScmPanel>
  );
}

function PaymentForm({
  onClose,
  supplierId,
  currency,
  presetBill,
}: {
  onClose: () => void;
  supplierId: number;
  currency: string;
  presetBill: SupplierBill | null;
}) {
  const { toast } = useToast();
  const create = useCreateSupplierPayment();
  const unpaid = useSupplierBills({ supplierId, limit: 100 });
  const [billId, setBillId] = useState(presetBill ? String(presetBill.id) : "");
  const [paymentDate, setPaymentDate] = useState(today());
  const [mode, setMode] = useState<SupplierPaymentMode>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(
    presetBill ? String(presetBill.outstanding) : "",
  );
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const payable = (unpaid.data?.data ?? []).filter(
    (b) => b.status === "OPEN" || b.status === "PARTIALLY_PAID",
  );
  const selected = payable.find((b) => String(b.id) === billId) ?? presetBill;

  function pickBill(value: string) {
    setBillId(value);
    const bill = payable.find((b) => String(b.id) === value);
    if (bill) setAmount(String(bill.outstanding));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    const n = Number(amount);
    if (!paymentDate) found.paymentDate = "Payment date is required";
    if (!amount || !(n > 0)) found.amount = "Enter an amount greater than zero";
    else if (billId && selected && n > selected.outstanding + 0.001) {
      found.amount = `Cannot exceed the ${formatMoney(selected.outstanding, selected.currency)} outstanding`;
    }
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setBusy(true);
    try {
      const created = await create.mutateAsync({
        supplierId,
        paymentDate,
        mode,
        amount: n,
        ...(billId ? { billId: Number(billId) } : {}),
        ...(reference.trim() ? { referenceNumber: reference.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast({
        title: `Payment ${created.paymentNumber} recorded`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setSubmitError(errorText(err, "Could not record the payment"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <SelectField
        label="Apply to bill"
        value={billId}
        onChange={pickBill}
        options={payable.map((b) => ({
          value: String(b.id),
          label: `${b.billNumber}${b.supplierBillNumber ? ` (Inv ${b.supplierBillNumber})` : ""} · ${formatMoney(b.outstanding, b.currency)} due`,
        }))}
        placeholder="On account / advance (no bill)"
        hint="Leave unselected to record an advance payment that is not tied to a bill."
        disabled={busy}
      />
      <FormGrid>
        <TextField
          label="Payment date"
          type="date"
          required
          value={paymentDate}
          onChange={setPaymentDate}
          error={errors.paymentDate}
          disabled={busy}
        />
        <SelectField
          label="Mode"
          required
          value={mode}
          onChange={(v) =>
            setMode((v || "BANK_TRANSFER") as SupplierPaymentMode)
          }
          options={PAYMENT_MODES}
          disabled={busy}
        />
        <TextField
          label={`Amount (${currency})`}
          type="number"
          required
          min={0}
          step={0.01}
          value={amount}
          onChange={setAmount}
          error={errors.amount}
          disabled={busy}
        />
        <TextField
          label="Reference"
          value={reference}
          onChange={setReference}
          placeholder="UTR / cheque no. / txn id"
          disabled={busy}
        />
      </FormGrid>
      <TextAreaField
        label="Notes"
        value={notes}
        onChange={setNotes}
        disabled={busy}
      />
      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {submitError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Record payment
        </Button>
      </div>
    </form>
  );
}

export function SupplierPaymentsTab({
  supplierId,
  currency,
}: {
  supplierId: number;
  currency: string;
}) {
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [voiding, setVoiding] = useState<SupplierPayment | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.finance.write");
  const query = useSupplierPayments({ supplierId, page, limit: PAGE_SIZE });
  const summary = useSupplierFinanceSummary(supplierId);
  const voidPayment = useVoidSupplierPayment();

  if (query.isPending) return <Skeleton className="h-48 w-full" />;
  if (query.isError) {
    return (
      <TabError
        error={query.error}
        permission="scm.finance.read"
        noun="supplier payments"
        onRetry={() => void query.refetch()}
      />
    );
  }
  const s = summary.data;
  const payments = query.data.data;
  const meta = query.data.meta;

  return (
    <div className="flex flex-col gap-4">
      {s ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            headingId="pay-total"
            label="Total paid"
            value={formatMoney(s.totalPaid, currency, 0)}
            note={`${s.paymentCount} payment(s)`}
            tone="success"
          />
          <StatCard
            headingId="pay-outstanding"
            label="Still outstanding"
            value={formatMoney(s.outstanding, currency, 0)}
            note={`${s.openBillCount} open bill(s)`}
            tone="warning"
          />
          <StatCard
            headingId="pay-advance"
            label="Advance / on account"
            value={formatMoney(s.unappliedPaid, currency, 0)}
            note="Paid, not applied to a bill"
          />
        </div>
      ) : null}

      {canWrite ? (
        <div className="flex justify-end">
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      ) : null}

      {payments.length === 0 ? (
        <Card>
          <EmptyState
            title="No payments yet"
            description="Payments made to this supplier appear here."
          />
        </Card>
      ) : (
        <DataTable<SupplierPayment>
          caption="Supplier payments"
          rows={payments}
          getRowKey={(p) => String(p.id)}
          columns={[
            {
              header: "Payment #",
              cell: (p) => (
                <span className="font-mono text-theme-xs">
                  {p.paymentNumber}
                </span>
              ),
            },
            { header: "Date", cell: (p) => formatDate(p.paymentDate) },
            { header: "Mode", cell: (p) => modeLabel(p.mode) },
            { header: "Reference", cell: (p) => p.referenceNumber ?? "—" },
            { header: "Bill", cell: (p) => p.bill?.billNumber ?? "On account" },
            {
              header: "Amount",
              align: "right",
              cell: (p) => formatMoney(p.amount, p.currency),
            },
            {
              header: "Status",
              cell: (p) => (
                <StatusBadge
                  label={p.status === "VOIDED" ? "Voided" : "Posted"}
                  colorToken={p.status === "VOIDED" ? "error" : "success"}
                />
              ),
            },
            {
              header: "Actions",
              headerClassName: "text-right",
              className: "text-right",
              cell: (p) =>
                canWrite && p.status === "POSTED" ? (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVoiding(p)}
                    >
                      Void
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      )}
      {meta && meta.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      ) : null}

      <PaymentDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supplierId={supplierId}
        currency={currency}
        presetBill={null}
      />
      <ReasonDialog
        open={voiding !== null}
        title={voiding ? `Void ${voiding.paymentNumber}` : "Void payment"}
        description="Voiding reverses the payment: the amount goes back onto its bill as outstanding."
        confirmLabel="Void payment"
        onClose={() => setVoiding(null)}
        onConfirm={async (reason) => {
          if (!voiding) return;
          await voidPayment.mutateAsync({ id: voiding.id, reason });
          toast({
            title: `${voiding.paymentNumber} voided`,
            variant: "success",
          });
          setVoiding(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const MAX_BYTES = 5 * 1024 * 1024;

function UploadDialog({
  open,
  onClose,
  supplierId,
}: {
  open: boolean;
  onClose: () => void;
  supplierId: number;
}) {
  const { toast } = useToast();
  const upload = useUploadSupplierDocument();
  const documentTypes = useMasterListItems({
    category: "supplier_document_type",
    page: 1,
    limit: 100,
  });
  const documentTypeOptions = (documentTypes.data?.data ?? []).map((t) => ({
    value: t.value,
    label: formatStatusLabel(t.value),
  }));
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function choose(f: File | null) {
    setError(null);
    if (f && f.size > MAX_BYTES) {
      setFile(null);
      setError("File must be 5 MB or smaller.");
      return;
    }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upload.mutateAsync({
        supplierId,
        file,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(type ? { documentType: type } : {}),
      });
      toast({ title: "Document uploaded", variant: "success" });
      setFile(null);
      setName("");
      setType("");
      onClose();
    } catch (err) {
      setError(errorText(err, "Could not upload the document"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScmPanel open={open} onClose={onClose} title="Upload Document" size="md">
      {open ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="supplier-doc-file"
              className="text-theme-sm font-medium text-gray-700 dark:text-gray-300"
            >
              File <span aria-hidden="true">*</span>
            </label>
            <input
              id="supplier-doc-file"
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              disabled={busy}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
              className="block w-full text-theme-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-theme-sm file:font-medium file:text-brand-700 dark:text-gray-300 dark:file:bg-brand-500/15 dark:file:text-brand-300"
            />
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              PDF, JPG or PNG, 5 MB or smaller.
            </p>
          </div>
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Defaults to the file name"
            disabled={busy}
          />
          <SelectField
            label="Type"
            value={type}
            onChange={setType}
            options={documentTypeOptions}
            placeholder="Select a type (optional)"
            disabled={busy}
          />
          {error ? (
            <p
              role="alert"
              className="text-theme-xs text-error-600 dark:text-error-400"
            >
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </form>
      ) : null}
    </ScmPanel>
  );
}

export function SupplierDocumentsTab({ supplierId }: { supplierId: number }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [removing, setRemoving] = useState<SupplierDocument | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.supplier.write");
  const query = useSupplierDocuments(supplierId);
  const remove = useRemoveSupplierDocument();

  async function open(doc: SupplierDocument, mode: "open" | "save") {
    try {
      await fetchSupplierDocument(supplierId, doc.id, doc.fileName, mode);
    } catch (err) {
      toast({
        title: errorText(err, "Could not open the document"),
        variant: "error",
      });
    }
  }

  if (query.isPending) return <Skeleton className="h-40 w-full" />;
  if (query.isError) {
    return (
      <TabError
        error={query.error}
        permission="scm.supplier.read"
        noun="supplier documents"
        onRetry={() => void query.refetch()}
      />
    );
  }
  const docs = query.data;

  return (
    <div className="flex flex-col gap-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      ) : null}

      {docs.length === 0 ? (
        <Card>
          <EmptyState
            title="No documents yet"
            description="Upload GST certificates, PAN, bank documents, contracts or compliance documents for this supplier."
          />
        </Card>
      ) : (
        <DataTable<SupplierDocument>
          caption="Supplier documents"
          rows={docs}
          getRowKey={(d) => String(d.id)}
          columns={[
            {
              header: "Name",
              cell: (d) => (
                <div className="flex flex-col">
                  <span className="font-medium">{d.name}</span>
                  {d.name !== d.fileName ? (
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {d.fileName}
                    </span>
                  ) : null}
                </div>
              ),
            },
            { header: "Type", cell: (d) => typeLabel(d.documentType) },
            {
              header: "Size",
              align: "right",
              cell: (d) => formatBytes(d.sizeBytes),
            },
            { header: "Uploaded", cell: (d) => formatDateTime(d.createdAt) },
            {
              header: "Actions",
              headerClassName: "text-right",
              className: "text-right",
              cell: (d) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    aria-label={`View ${d.name}`}
                    onClick={() => void open(d, "open")}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    aria-label={`Download ${d.name}`}
                    onClick={() => void open(d, "save")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                  {canWrite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      aria-label={`Delete ${d.name}`}
                      onClick={() => setRemoving(d)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        supplierId={supplierId}
      />
      <ConfirmRemove
        doc={removing}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove.mutateAsync({ supplierId, id: removing.id });
            toast({ title: "Document deleted", variant: "success" });
            setRemoving(null);
          } catch (err) {
            toast({
              title: errorText(err, "Could not delete the document"),
              variant: "error",
            });
          }
        }}
        loading={remove.isPending}
      />
    </div>
  );
}

function ConfirmRemove({
  doc,
  onClose,
  onConfirm,
  loading,
}: {
  doc: SupplierDocument | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <Dialog
      open={doc !== null}
      onClose={onClose}
      title="Delete document"
      size="sm"
    >
      {doc ? (
        <div className="flex flex-col gap-4">
          <p className="text-theme-sm text-gray-600 dark:text-gray-300">
            Delete <strong>{doc.name}</strong>? The file is removed and cannot
            be recovered.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={loading}
              onClick={() => void onConfirm()}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
