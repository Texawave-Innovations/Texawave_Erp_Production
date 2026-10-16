"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, Pencil, Trash2 } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DeleteConfirmDialog,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { formatDate } from "../../shared/format";
import { revealBankAccount } from "../api";
import { useCustomer, useDeleteCustomer } from "../hooks";
import type { Customer, CustomerAddress } from "../types";

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

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
        {title}
      </h2>
      {children}
    </Card>
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
  const { toast } = useToast();
  const [full, setFull] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!customer.bankAccountNumberMasked) return <>—</>;

  async function reveal() {
    setLoading(true);
    try {
      setFull(await revealBankAccount(customer.id));
    } catch {
      toast({ title: "Could not reveal the account number", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono">
        {full ?? customer.bankAccountNumberMasked}
      </span>
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
  const { toast } = useToast();
  const canRead = usePermission(SALES_PERMISSIONS.customerRead);
  const canWrite = usePermission(SALES_PERMISSIONS.customerWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.customerDelete);
  const query = useCustomer(canRead ? id : null);
  const remove = useDeleteCustomer();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to customers">
        Ask an administrator for the <code>sales.customer.read</code>{" "}
        permission.
      </Alert>
    );
  }
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert variant="warning" title="Customer not found">
        It may have been deleted.{" "}
        <Link href="/sales/customers">Back to customers</Link>
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const c = query.data;

  async function handleDelete() {
    try {
      await remove.mutateAsync(c.id);
      toast({ title: `${c.companyName} deleted`, variant: "success" });
      router.push("/sales/customers");
    } catch (error) {
      setConfirmDelete(false);
      toast({
        title:
          error instanceof ApiError &&
          error.errorCode === "CUSTOMER_HAS_DOCUMENTS"
            ? `${c.companyName} has documents and cannot be deleted`
            : `Could not delete ${c.companyName}`,
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/sales/customers"
        className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← Back to customers
      </Link>
      <PageHeader
        variant="banner"
        title={c.companyName}
        description={`${c.customerCode} · added ${formatDate(c.createdAt)}`}
        icon={Building2}
        badge={
          <StatusBadge
            label={c.status === "ACTIVE" ? "Active" : "Inactive"}
            colorToken={c.status === "ACTIVE" ? "success" : "gray"}
          />
        }
        action={
          <div className="flex flex-wrap gap-2">
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Contact">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact person" value={c.contactPerson} />
            <Field label="Email" value={c.email} />
            <Field
              label="Mobile"
              value={`${c.mobileCountryCode} ${c.mobileNumber}`}
            />
          </dl>
        </Panel>
        <Panel title="Tax details">
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
        </Panel>
        <Panel title="Bank details">
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
        </Panel>
        <Panel title="Addresses">
          {c.addresses.length === 0 ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              No addresses.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {c.addresses.map((a) => (
                <AddressCard key={a.id} a={a} />
              ))}
            </div>
          )}
        </Panel>
      </div>

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
