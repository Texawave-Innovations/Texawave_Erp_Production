"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DatePicker,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import { CustomerPicker } from "../../shared/components/CustomerPicker";
import { formatInr, todayIst } from "../../shared/format";
import { useMasterOptions } from "../../shared/hooks";
import { decimal, ISO_DATE, optionalText } from "../../shared/priced-form";
import { useInvoices } from "../../invoices/hooks";
import {
  useCreatePayment,
  useNextPaymentNumber,
  useUpdatePayment,
} from "../hooks";
import type { Payment, PaymentBody } from "../types";

/** The invoice a payment is (or will be) against. */
export interface PayableInvoice {
  id: number;
  invoiceNumber: string;
  totalAmount: string;
  balance: string;
  customerName: string;
}

const OTHER = "other";

function buildSchema(maxAmount: number | null) {
  return z
    .object({
      customerId: z.number().nullable(),
      invoiceId: z.string().min(1, "Select an invoice."),
      amount: decimal({
        dp: 2,
        min: 0,
        max: 999_999_999_999,
        minExclusive: true,
        message: "Enter an amount above 0 (up to 2 decimals).",
      }),
      paymentDate: z.string().regex(ISO_DATE, "Enter a date."),
      dueDate: z.string().refine((v) => v === "" || ISO_DATE.test(v), {
        message: "Enter a date.",
      }),
      modeChoice: z.string().min(1, "Choose a payment mode."),
      modeText: optionalText(50),
      reference: optionalText(100),
      notes: optionalText(2000),
    })
    .superRefine((v, ctx) => {
      if (v.modeChoice === OTHER && v.modeText.trim() === "") {
        ctx.addIssue({
          code: "custom",
          path: ["modeText"],
          message: "Type the payment mode.",
        });
      }
      if (
        maxAmount !== null &&
        v.amount !== "" &&
        Number(v.amount) > maxAmount
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: `The balance is ${formatInr(maxAmount)}; the payment cannot exceed it.`,
        });
      }
    });
}

/**
 * "Record Payment" (new) or "Edit Payment". A new payment picks the customer,
 * then one of their open invoices — or comes with `invoice` fixed (from the
 * invoice screen). The server issues the number (TW/PR/…), keeps the total
 * within the invoice balance and updates the invoice.
 */
export function PaymentFormDialog({
  open,
  onClose,
  invoice,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  /** Fixed invoice (invoice screen). */
  invoice?: PayableInvoice | undefined;
  /** Edit this payment (its invoice cannot change). */
  payment?: Payment | undefined;
}) {
  const { toast } = useToast();
  const create = useCreatePayment();
  const update = useUpdatePayment();
  const modes = useMasterOptions("PAYMENT_RECEIVED").byField("PAYMENT_MODE");
  const editing = payment !== undefined;
  const [values, setValues] = useState(() => ({
    customerId: payment?.customer.id ?? null,
    invoiceId: String(payment?.invoiceId ?? invoice?.id ?? ""),
    amount: payment ? String(Number(payment.amount)) : "",
    paymentDate: payment ? payment.paymentDate.slice(0, 10) : todayIst(),
    dueDate: payment?.dueDate ? payment.dueDate.slice(0, 10) : "",
    modeChoice: payment
      ? payment.modeItemId !== null
        ? String(payment.modeItemId)
        : OTHER
      : "",
    modeText: payment && payment.modeItemId === null ? payment.mode : "",
    reference: payment?.reference ?? "",
    notes: payment?.notes ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A new payment without a fixed invoice: the customer's open invoices.
  const pickInvoice = !editing && invoice === undefined;
  const invoices = useInvoices(
    {
      page: 1,
      limit: 100,
      ...(values.customerId ? { customerId: values.customerId } : {}),
    },
    pickInvoice && values.customerId !== null,
  );
  const openInvoices = (invoices.data?.data ?? []).filter(
    (i) => i.status === "UNPAID" || i.status === "PARTIALLY_PAID",
  );

  const chosen: PayableInvoice | undefined = useMemo(() => {
    if (payment) {
      return {
        id: payment.invoice.id,
        invoiceNumber: payment.invoice.invoiceNumber,
        totalAmount: payment.invoice.totalAmount,
        // This payment's own amount is available again while editing it.
        balance: String(
          Number(payment.invoice.balance) + Number(payment.amount),
        ),
        customerName: payment.customer.companyName,
      };
    }
    if (invoice) return invoice;
    const i = openInvoices.find((x) => String(x.id) === values.invoiceId);
    return i
      ? {
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          totalAmount: i.totalAmount,
          balance: i.balance,
          customerName: i.customerSnapshot.companyName,
        }
      : undefined;
  }, [payment, invoice, openInvoices, values.invoiceId]);

  const schema = useMemo(
    () => buildSchema(chosen ? Number(chosen.balance) : null),
    [chosen],
  );
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(schema, values);
  const nextNumber = useNextPaymentNumber(values.paymentDate, !editing);

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => {
    changed(String(k));
    setValues((s) => ({ ...s, [k]: v }));
  };

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const v = validateAll();
    if (!v) return;
    const body: PaymentBody = {
      amount: Number(v.amount),
      paymentDate: v.paymentDate,
      dueDate: v.dueDate === "" ? null : v.dueDate,
      modeItemId: v.modeChoice === OTHER ? null : Number(v.modeChoice),
      ...(v.modeChoice === OTHER ? { mode: v.modeText.trim() } : {}),
      reference: v.reference.trim() || null,
      notes: v.notes.trim() || null,
    };
    setSaving(true);
    setError(null);
    try {
      const saved = editing
        ? await update.mutateAsync({ id: payment.id, body })
        : await create.mutateAsync({ ...body, invoiceId: Number(v.invoiceId) });
      toast({
        title: `Payment ${saved.paymentNumber} ${editing ? "saved" : "recorded"}`,
        description: `Balance on ${saved.invoice.invoiceNumber}: ${formatInr(saved.invoice.balance)}`,
        variant: "success",
      });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === "PAYMENT_EXCEEDS_BALANCE") {
        setServerErrors({ amount: e.message });
      }
      setError(
        e instanceof ApiError ? e.message : "Could not save the payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        editing
          ? `Edit payment ${payment.paymentNumber}`
          : `Record payment${nextNumber.data ? ` — ${nextNumber.data}` : ""}`
      }
      size="lg"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
        {error ? (
          <Alert variant="error" title="Payment not saved">
            {error}
          </Alert>
        ) : null}

        {pickInvoice ? (
          <>
            <FormField label="Customer" required>
              {(f) => (
                <CustomerPicker
                  id={f.id}
                  describedBy={f["aria-describedby"]}
                  value={values.customerId}
                  onChange={(id) =>
                    setValues((s) => ({ ...s, customerId: id, invoiceId: "" }))
                  }
                />
              )}
            </FormField>
            <FormField
              label="Invoice"
              required
              errorVariant="bubble"
              error={errorFor("invoiceId")}
              hint={
                values.customerId !== null &&
                !invoices.isPending &&
                openInvoices.length === 0
                  ? "This customer has no invoice with a balance."
                  : undefined
              }
            >
              {(f) => (
                <Select
                  {...f}
                  value={values.invoiceId}
                  disabled={values.customerId === null}
                  onBlur={() => touch("invoiceId")}
                  onChange={(e) => set("invoiceId", e.target.value)}
                >
                  <option value="">
                    {values.customerId === null
                      ? "Choose a customer first"
                      : "Select an open invoice"}
                  </option>
                  {openInvoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoiceNumber} — balance {formatInr(i.balance)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </>
        ) : chosen ? (
          <p className="text-theme-sm text-gray-700 dark:text-gray-300">
            Against <strong>{chosen.invoiceNumber}</strong> (
            {chosen.customerName})
          </p>
        ) : null}

        {chosen ? (
          <dl className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 text-theme-sm dark:bg-gray-800/60">
            <dt className="text-gray-500 dark:text-gray-400">Invoice total</dt>
            <dd className="text-right">{formatInr(chosen.totalAmount)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">
              {editing ? "Available for this payment" : "Balance"}
            </dt>
            <dd className="text-right font-semibold">
              {formatInr(chosen.balance)}
            </dd>
          </dl>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Amount received (₹)"
            required
            errorVariant="bubble"
            error={errorFor("amount")}
          >
            {(f) => (
              <Input
                {...f}
                inputMode="decimal"
                value={values.amount}
                onBlur={() => touch("amount")}
                onChange={(e) => set("amount", e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Payment date"
            required
            errorVariant="bubble"
            error={errorFor("paymentDate")}
          >
            {(f) => (
              <DatePicker
                {...f}
                value={values.paymentDate}
                onBlur={() => touch("paymentDate")}
                onChange={(e) => set("paymentDate", e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Due date"
            errorVariant="bubble"
            error={errorFor("dueDate")}
            hint="When the remaining balance is due; overdue after it."
          >
            {(f) => (
              <DatePicker
                {...f}
                value={values.dueDate}
                onBlur={() => touch("dueDate")}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Payment mode"
            required
            errorVariant="bubble"
            error={errorFor("modeChoice")}
          >
            {(f) => (
              <Select
                {...f}
                value={values.modeChoice}
                onBlur={() => touch("modeChoice")}
                onChange={(e) => set("modeChoice", e.target.value)}
              >
                <option value="">Choose a mode</option>
                {modes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                <option value={OTHER}>Other (type it)</option>
              </Select>
            )}
          </FormField>
          {values.modeChoice === OTHER ? (
            <FormField
              label="Mode"
              required
              errorVariant="bubble"
              error={errorFor("modeText")}
            >
              {(f) => (
                <Input
                  {...f}
                  maxLength={50}
                  placeholder="e.g. NEFT"
                  value={values.modeText}
                  onBlur={() => touch("modeText")}
                  onChange={(e) => set("modeText", e.target.value)}
                />
              )}
            </FormField>
          ) : null}
          <FormField
            label="Transaction reference / UTR"
            errorVariant="bubble"
            error={errorFor("reference")}
          >
            {(f) => (
              <Input
                {...f}
                maxLength={100}
                placeholder="UTR123456789 / Cheque #004521"
                value={values.reference}
                onBlur={() => touch("reference")}
                onChange={(e) => set("reference", e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField
          label="Internal remarks"
          errorVariant="bubble"
          error={errorFor("notes")}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              value={values.notes}
              onBlur={() => touch("notes")}
              onChange={(e) => set("notes", e.target.value)}
            />
          )}
        </FormField>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? "Save payment" : "Record payment"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
