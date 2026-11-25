"use client";

import { salesTabHref } from "@/features/sales/shared/tabs";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileText, MapPin, Pencil, Receipt, Trash2 } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  Skeleton,
  StatusBadge,
  Tabs,
} from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { formatDate } from "../../shared/format";
import { revealBankAccount } from "../api";
import { useCustomer, useDeleteCustomer } from "../hooks";
import type { AddressType, Customer, CustomerAddress } from "../types";
import { BackArrow } from "./CustomerFormView";
import { CustomerInvoiceHistoryDialog } from "./CustomerInvoiceHistoryDialog";
import { CustomerStatementDialog } from "./CustomerStatementDialog";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="text-theme-sm text-gray-900 dark:text-white/90">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

const rate = (v: string | null) => (v === null ? null : `${v}%`);

function AddressCard({ a }: { a: CustomerAddress }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          {a.label}
        </span>
        <StatusBadge
          label={a.addressType === "BILLING" ? "Billing" : "Shipping"}
          colorToken="brand"
        />
        {a.isDefault ? (
          <StatusBadge label="Default" colorToken="success" />
        ) : null}
      </div>
      <p className="text-theme-sm text-gray-600 dark:text-gray-300">
        {[a.street, a.area, a.city].filter(Boolean).join(", ")}
        <br />
        {a.stateName ?? a.stateCode} — {a.pincode}, {a.country}
      </p>
    </div>
  );
}

function BankAccount({ customer }: { customer: Customer }) {
  const canReveal = usePermission(SALES_PERMISSIONS.customerBankReveal);
  const { notify } = useNotify();
  const [full, setFull] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!customer.bankAccountNumberMasked) return <>—</>;

  async function reveal() {
    setLoading(true);
    try {
      setFull(await revealBankAccount(customer.id));
    } catch {
      notify("sales.customer.revealFailed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{full ?? customer.bankAccountNumberMasked}</span>
      {canReveal && full === null ? (
        <Button
          variant="ghost"
          size="sm"
          loading={loading}
          onClick={() => void reveal()}
          aria-label="Reveal full account number"
        >
          <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
          Reveal
        </Button>
      ) : null}
    </span>
  );
}

export function CustomerDetailView({ id }: { id: number }) {
  const router = useRouter();
  const { notify, notifyError } = useNotify();
  const canRead = usePermission(SALES_PERMISSIONS.customerRead);
  const canWrite = usePermission(SALES_PERMISSIONS.customerWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.customerDelete);
  const query = useCustomer(canRead ? id : null);
  const remove = useDeleteCustomer();
  const canSeeInvoices = usePermission(SALES_PERMISSIONS.invoiceRead);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [tab, setTab] = useState<AddressType>("BILLING");

  if (!canRead) {
    return (
      <Alert
        dismissible
        variant="warning"
        title="You don't have access to customers"
      >
        Ask an administrator for the <code>sales.customer.read</code>{" "}
        permission.
      </Alert>
    );
  }
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert dismissible variant="warning" title="Customer not found">
        It may have been deleted.{" "}
        <Link href={salesTabHref("customers")}>Back to customers</Link>
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const c = query.data;

  async function handleDelete() {
    try {
      await remove.mutateAsync(c.id);
      notify("sales.customer.deleted", { name: c.companyName });
      router.push(salesTabHref("customers"));
    } catch (error) {
      setConfirmDelete(false);
      notifyError(error, "sales.customer.deleteFailed", {
        name: c.companyName,
      });
    }
  }

  const inTab = c.addresses.filter((a) => a.addressType === tab);
  const countOf = (t: AddressType) =>
    c.addresses.filter((a) => a.addressType === t).length;
  const kindWord = tab === "BILLING" ? "billing" : "shipping";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={c.companyName}
        description={`${c.customerCode} · added ${formatDate(c.createdAt)}`}
        icon={
          <BackArrow
            href={salesTabHref("customers")}
            label="Back to customers"
          />
        }
        badge={
          <StatusBadge
            label={c.status === "ACTIVE" ? "Active" : "Inactive"}
            colorToken={c.status === "ACTIVE" ? "success" : "gray"}
          />
        }
        action={
          <div className="flex flex-wrap gap-2">
            {canSeeInvoices ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setHistoryOpen(true)}
                >
                  <Receipt className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Invoice history
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setStatementOpen(true)}
                >
                  <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Statement
                </Button>
              </>
            ) : null}
            {canWrite ? (
              <Button
                variant="secondary"
                onClick={() => router.push(`/sales/customers/${c.id}/edit`)}
              >
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard title="Contact">
          <dl className="grid grid-cols-1 gap-4">
            <Field label="Contact person" value={c.contactPerson} />
            <Field
              label="Mobile"
              value={`${c.mobileCountryCode} ${c.mobileNumber}`}
            />
            <Field label="Email" value={c.email} />
          </dl>
        </SectionCard>
        <SectionCard title="Tax details">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="GSTIN" value={c.gstin} />
            <Field
              label="State"
              value={
                c.stateCode ? `${c.stateCode} — ${c.stateName ?? ""}` : null
              }
            />
            <Field label="PAN" value={c.pan} />
            <Field label="CIN" value={c.cin} />
            <Field label="CGST" value={rate(c.cgstRate)} />
            <Field label="SGST" value={rate(c.sgstRate)} />
            <Field label="IGST" value={rate(c.igstRate)} />
          </dl>
        </SectionCard>
        <SectionCard title="Bank details">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bank" value={c.bankName} />
            <Field
              label="Account number"
              value={<BankAccount customer={c} />}
            />
            <Field label="IFSC" value={c.bankIfsc} />
            <Field label="Branch" value={c.bankBranch} />
            <Field label="Payment notes" value={c.paymentNotes} />
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title="Billing & shipping addresses"
        description="One default billing and one default shipping address."
      >
        <Tabs<AddressType>
          label="Address type"
          idPrefix="customer-detail-address"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "BILLING", label: `Billing (${countOf("BILLING")})` },
            { id: "SHIPPING", label: `Shipping (${countOf("SHIPPING")})` },
          ]}
        >
          {inTab.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 pt-6 dark:border-gray-700">
              <MapPin
                className="h-8 w-8 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
              <EmptyState title={`No ${kindWord} addresses`} />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {inTab.map((a) => (
                <AddressCard key={a.id} a={a} />
              ))}
            </div>
          )}
        </Tabs>
      </SectionCard>

      {canSeeInvoices ? (
        <>
          <CustomerInvoiceHistoryDialog
            customer={historyOpen ? c : null}
            onClose={() => setHistoryOpen(false)}
            onOpenStatement={() => setStatementOpen(true)}
          />
          <CustomerStatementDialog
            customer={statementOpen ? c : null}
            onClose={() => setStatementOpen(false)}
          />
        </>
      ) : null}

      {canDelete ? (
        <DeleteConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Delete customer"
          itemName={c.companyName}
          description="Customers with quotations, invoices or challans cannot be deleted."
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}
