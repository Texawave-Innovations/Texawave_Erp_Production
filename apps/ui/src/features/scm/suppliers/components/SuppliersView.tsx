"use client";

import type {
  CreateSupplierInput,
  Supplier,
  SupplierStatus,
} from "@texawave-erp/api-types";
import { SUPPLIER_STATUSES } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  ErrorState,
  Pagination,
  PageHeader,
  Select,
  StatusBadge,
  TableSkeleton,
  TableToolbar,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Eye,
  Factory,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDebouncedValue } from "@/features/hr/employees/hooks";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateSupplier,
  useSuppliers,
  useSupplierTypes,
  useUpdateSupplier,
} from "../hooks";
import { supplierStatusToken, toggledStatus } from "../utils";
import { SupplierForm } from "./SupplierForm";

import { ScmPanel } from "../../shared/ScmPanel";
const PAGE_SIZE = 10;
const ALL = "all";

/** Legacy `ScmSuppliers` list: search (code/company/contact/email/phone/GSTIN),
 * Status and Type filters, the same columns, row actions View / Edit /
 * Active-Inactive toggle, and an Add Supplier form. */
export function SuppliersView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const { toast } = useToast();

  const canWrite = usePermission("scm.supplier.write");
  const query = useSuppliers({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
    ...(statusFilter !== ALL ? { status: statusFilter as SupplierStatus } : {}),
    ...(typeFilter !== ALL ? { type: typeFilter } : {}),
  });
  const typesQuery = useSupplierTypes();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();

  const hasActiveFilters = Boolean(
    search || statusFilter !== ALL || typeFilter !== ALL,
  );

  function resetFilters() {
    setSearch("");
    setStatusFilter(ALL);
    setTypeFilter(ALL);
    setPage(1);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function handleSave(input: CreateSupplierInput) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, input });
      toast({ title: "Supplier updated", variant: "success" });
    } else {
      await createMutation.mutateAsync(input);
      toast({ title: "Supplier created", variant: "success" });
    }
    closeForm();
  }

  async function handleToggle(supplier: Supplier) {
    const next = toggledStatus(supplier.status);
    if (!next) return;
    try {
      await updateMutation.mutateAsync({
        id: supplier.id,
        input: { status: next },
      });
      toast({ title: `Supplier marked ${next}`, variant: "success" });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError
            ? err.message
            : "Failed to update supplier status",
        variant: "error",
      });
    }
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-24 w-full animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
        <TableSkeleton rowsCount={6} columnsCount={8} />
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
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const rows = query.data.data;
  const meta = query.data.meta;
  const types = typesQuery.data ?? [];
  const addButton = canWrite ? (
    <Button size="sm" onClick={() => setFormOpen(true)} className="gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Supplier</span>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={Factory}
        title="Suppliers"
        description="Manage vendors, contacts, purchasing terms, performance and supplier relationships."
        badge={
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#0a3271] dark:bg-gray-800/70 dark:text-sky-100">
            {meta.total} {meta.total === 1 ? "supplier" : "suppliers"}
          </span>
        }
        action={addButton}
      />

      <TableToolbar
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          onClear: () => {
            setSearch("");
            setPage(1);
          },
          placeholder: "Search by code, name, contact, email, phone, GSTIN...",
          ariaLabel: "Search suppliers",
        }}
        filters={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="w-full sm:w-44">
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value={ALL}>All Statuses</option>
                {SUPPLIER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            {types.length > 0 && (
              <div className="w-full sm:w-44">
                <Select
                  aria-label="Filter by type"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value={ALL}>All Types</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        }
        hasActiveFilters={hasActiveFilters}
        onClearFilters={resetFilters}
        clearFiltersLabel="Reset"
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-gray-800/60 dark:text-gray-500">
            <Factory className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
            {hasActiveFilters
              ? "No suppliers match the current filters"
              : "No suppliers yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
            {hasActiveFilters
              ? "Try a different search or reset the active filters."
              : "Add your first supplier to start building your procurement network."}
          </p>
          <div className="mt-5 flex items-center justify-center">
            {hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            ) : (
              addButton
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable<Supplier>
            caption="Suppliers"
            columns={[
              {
                header: "Code",
                cell: (s) => (
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-theme-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {s.supplierCode}
                  </span>
                ),
              },
              {
                header: "Company",
                cell: (s) => (
                  <div className="flex flex-col">
                    <Link
                      href={`/scm/suppliers/${s.id}`}
                      className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {s.companyName}
                    </Link>
                    {s.type ? (
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {s.type}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              { header: "Primary Contact", cell: (s) => s.contactPerson },
              { header: "Phone", cell: (s) => s.phone || "—" },
              {
                header: "Email",
                cell: (s) => (
                  <span className="text-gray-500 dark:text-gray-400">
                    {s.email || "—"}
                  </span>
                ),
              },
              {
                header: "GSTIN",
                cell: (s) =>
                  s.gstin ? (
                    <span className="font-mono text-theme-xs">{s.gstin}</span>
                  ) : (
                    "—"
                  ),
              },
              { header: "Payment Terms", cell: (s) => s.paymentTerms || "—" },
              {
                header: "Lead Time",
                cell: (s) => (s.leadTimeDays ? `${s.leadTimeDays}d` : "—"),
              },
              {
                header: "Rating",
                cell: (s) =>
                  s.rating ? (
                    <span className="inline-flex items-center gap-1 text-warning-600">
                      <Star className="h-3.5 w-3.5 fill-warning-400 text-warning-400" />
                      {s.rating}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Status",
                cell: (s) => (
                  <StatusBadge
                    label={s.status}
                    colorToken={supplierStatusToken(s.status)}
                  />
                ),
              },
              {
                header: "Actions",
                headerClassName: "text-right",
                className: "text-right",
                cell: (s) => {
                  const toggle = toggledStatus(s.status);
                  return (
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/scm/suppliers/${s.id}`}
                        aria-label={`View ${s.companyName}`}
                        title="View Supplier"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 hover:bg-gray-100 dark:text-brand-300 dark:hover:bg-gray-800"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canWrite ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit Supplier"
                            aria-label={`Edit ${s.companyName}`}
                            onClick={() => {
                              setEditing(s);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!toggle}
                            title={
                              toggle
                                ? toggle === "Inactive"
                                  ? "Deactivate"
                                  : "Activate"
                                : `${s.status} — change status via Edit`
                            }
                            aria-label={
                              toggle
                                ? `${toggle === "Inactive" ? "Deactivate" : "Activate"} ${s.companyName}`
                                : `${s.companyName} status can only be changed via Edit`
                            }
                            onClick={() => void handleToggle(s)}
                          >
                            <Power
                              className={`h-4 w-4 ${s.status === "Active" ? "text-success-600" : "text-gray-400"}`}
                            />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  );
                },
              },
            ]}
            rows={rows}
            getRowKey={(s) => String(s.id)}
          />

          <div className="flex flex-col gap-3 px-1 py-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              Showing {(meta.page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(meta.page * PAGE_SIZE, meta.total)} of {meta.total}{" "}
              suppliers
            </span>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <ScmPanel
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit Supplier" : "Add Supplier"}
        size="2xl"
      >
        {formOpen ? (
          <SupplierForm
            key={editing?.id ?? "new"}
            supplier={editing}
            onSubmit={handleSave}
            onCancel={closeForm}
          />
        ) : null}
      </ScmPanel>
    </div>
  );
}
