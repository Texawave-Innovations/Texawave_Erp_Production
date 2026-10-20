"use client";

import type { CreateSupplierInput } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  Tabs,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  ArrowLeft,
  Building2,
  History,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useSupplier, useSupplierActivity, useUpdateSupplier } from "../hooks";
import {
  formatSupplierDateTime,
  formatSupplierMoney,
  supplierAddressLine,
  supplierStatusToken,
} from "../utils";
import {
  SupplierBillsTab,
  SupplierDocumentsTab,
  SupplierPaymentsTab,
} from "./SupplierFinanceTabs";
import { SupplierForm } from "./SupplierForm";
import {
  SupplierProcurementTab,
  type ProcurementTabId,
} from "./SupplierProcurementTabs";
import { SupplierReturnsTab } from "./SupplierReturnsTab";

import { ScmPanel } from "../../shared/ScmPanel";
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "products", label: "Products" },
  { id: "rfqs", label: "RFQs" },
  { id: "quotations", label: "Supplier Quotations" },
  { id: "pos", label: "Purchase Orders" },
  { id: "grns", label: "GRNs" },
  { id: "bills", label: "Bills" },
  { id: "payments", label: "Payments" },
  { id: "returns", label: "Returns" },
  { id: "performance", label: "Performance" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-theme-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </div>
      {children}
    </Card>
  );
}

function Line({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-theme-sm text-gray-900 dark:text-white/90">
      <span className="text-gray-500 dark:text-gray-400">{label}: </span>
      {children}
    </div>
  );
}

function ActivityTab({ id, active }: { id: number; active: boolean }) {
  const query = useSupplierActivity(id, active);
  if (query.isPending) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  if (query.data.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No activity recorded yet"
          description="Supplier creation, edits and status changes will be logged here."
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {query.data.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
        >
          <History
            className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
              {activityLabel(entry)}
            </p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {entry.byName ?? "System"} · {formatSupplierDateTime(entry.at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const ACTIVITY_LABELS: Record<string, string> = {
  create: "Supplier created",
  update: "Supplier updated",
  document_upload: "Document uploaded",
  document_remove: "Document deleted",
  bill_create: "Bill recorded",
  payment_create: "Payment recorded",
};

function activityLabel(entry: {
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (entry.action === "status_change") {
    return `Supplier status changed${statusDelta(entry.before, entry.after)}`;
  }
  const base = ACTIVITY_LABELS[entry.action] ?? "Supplier updated";
  const a = entry.after;
  const detail =
    typeof a?.name === "string"
      ? a.name
      : typeof a?.billNumber === "string"
        ? a.billNumber
        : typeof a?.paymentNumber === "string"
          ? a.paymentNumber
          : null;
  return detail ? `${base}: ${detail}` : base;
}

function statusDelta(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const from = before?.status;
  const to = after?.status;
  return typeof from === "string" && typeof to === "string"
    ? `: ${from} → ${to}`
    : "";
}

export function SupplierDetail({ id }: { id: number }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  const canWrite = usePermission("scm.supplier.write");
  const query = useSupplier(id);
  const updateMutation = useUpdateSupplier();

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to suppliers">
          Ask an administrator for the <code>scm.supplier.read</code>{" "}
          permission.
        </Alert>
      );
    }
    if (error instanceof ApiError && error.statusCode === 404) {
      return (
        <Card>
          <EmptyState
            title="Supplier not found"
            description="It may have been removed or belongs to another organization."
            action={
              <Link href="/scm/suppliers">
                <Button variant="secondary" size="sm">
                  Back to suppliers
                </Button>
              </Link>
            }
          />
        </Card>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const supplier = query.data;
  const address = supplierAddressLine(supplier);

  async function handleSave(input: CreateSupplierInput) {
    await updateMutation.mutateAsync({ id, input });
    toast({ title: "Supplier updated", variant: "success" });
    setEditOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/scm/suppliers"
                aria-label="Back to suppliers"
                className="group inline-flex items-center gap-3 rounded-xl py-1 pr-3 outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-300 dark:hover:bg-gray-800"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-gray-700">
                  <ArrowLeft className="h-4 w-4" />
                </span>
                <h1 className="text-title-sm sm:text-title-md font-bold tracking-tight text-gray-900 dark:text-white/90">
                  {supplier.companyName}
                </h1>
              </Link>
              <StatusBadge
                label={supplier.status}
                colorToken={supplierStatusToken(supplier.status)}
              />
            </div>
            <p className="font-mono text-theme-sm text-gray-500 dark:text-gray-400">
              {supplier.supplierCode}
            </p>
          </div>
        </div>
        {canWrite ? (
          <Button size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit Supplier
          </Button>
        ) : null}
      </div>

      <Tabs
        label="Supplier sections"
        idPrefix="supplier"
        tabs={TABS}
        value={tab}
        onChange={setTab}
      >
        {tab === "overview" ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InfoCard icon={Building2} title="Contact">
                <div className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
                  {supplier.contactPerson}
                </div>
                <div className="flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
                  <Phone className="h-3.5 w-3.5 text-brand-600" />
                  {supplier.phone || "—"}
                </div>
                <div className="flex items-center gap-2 truncate text-theme-sm text-gray-500 dark:text-gray-400">
                  <Mail className="h-3.5 w-3.5 text-brand-600" />
                  {supplier.email || "—"}
                </div>
              </InfoCard>
              <InfoCard icon={MapPin} title="Tax & Location">
                <Line label="GST">
                  <span className="font-mono">{supplier.gstin || "—"}</span>
                </Line>
                <Line label="PAN">
                  <span className="font-mono">{supplier.pan || "—"}</span>
                </Line>
                <div className="truncate text-theme-sm text-gray-500 dark:text-gray-400">
                  {address || "—"}
                </div>
              </InfoCard>
              <InfoCard icon={Landmark} title="Commercial">
                <Line label="Payment Terms">
                  {supplier.paymentTerms || "—"}
                </Line>
                <Line label="Credit Limit">
                  {Number(supplier.creditLimit) > 0
                    ? formatSupplierMoney(
                        supplier.creditLimit,
                        supplier.currency,
                      )
                    : "—"}
                </Line>
                <Line label="Lead Time">
                  {supplier.leadTimeDays
                    ? `${supplier.leadTimeDays} days`
                    : "—"}
                </Line>
                {supplier.rating ? (
                  <div className="flex items-center gap-1 text-theme-sm text-gray-900 dark:text-white/90">
                    <Star className="h-3.5 w-3.5 fill-warning-400 text-warning-400" />
                    {supplier.rating} / 5
                  </div>
                ) : null}
              </InfoCard>
            </div>
            {supplier.notes ? (
              <Card>
                <div className="mb-1 text-theme-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Notes
                </div>
                <p className="whitespace-pre-wrap text-theme-sm text-gray-900 dark:text-white/90">
                  {supplier.notes}
                </p>
              </Card>
            ) : null}
            <Card>
              <EmptyState
                title="Procurement data will appear here once transactions are available."
                description="Create a purchase order for this supplier from Procurement to see live totals here."
              />
            </Card>
          </div>
        ) : null}

        {tab === "contacts" ? (
          <DataTable<{ id: number }>
            caption="Supplier contacts"
            columns={[
              { header: "Name", cell: () => supplier.contactPerson },
              {
                header: "Role",
                cell: () => (
                  <span className="text-gray-500 dark:text-gray-400">—</span>
                ),
              },
              { header: "Phone", cell: () => supplier.phone || "—" },
              { header: "Email", cell: () => supplier.email || "—" },
              {
                header: "Primary",
                cell: () => <StatusBadge label="Primary" colorToken="brand" />,
              },
            ]}
            rows={[{ id: supplier.id }]}
            getRowKey={(r) => String(r.id)}
          />
        ) : null}

        {tab === "activity" ? <ActivityTab id={id} active /> : null}

        {(
          [
            "products",
            "rfqs",
            "quotations",
            "pos",
            "grns",
            "performance",
          ] as const
        ).includes(tab as ProcurementTabId) ? (
          <SupplierProcurementTab
            supplierId={id}
            tab={tab as ProcurementTabId}
            currency={supplier.currency}
          />
        ) : null}

        {tab === "bills" ? (
          <SupplierBillsTab supplierId={id} currency={supplier.currency} />
        ) : null}
        {tab === "payments" ? (
          <SupplierPaymentsTab supplierId={id} currency={supplier.currency} />
        ) : null}
        {tab === "returns" ? <SupplierReturnsTab supplierId={id} /> : null}
        {tab === "documents" ? <SupplierDocumentsTab supplierId={id} /> : null}
      </Tabs>

      <ScmPanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Supplier"
        size="2xl"
      >
        {editOpen ? (
          <SupplierForm
            key={supplier.updatedAt}
            supplier={supplier}
            onSubmit={handleSave}
            onCancel={() => setEditOpen(false)}
          />
        ) : null}
      </ScmPanel>
    </div>
  );
}
