"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Eye,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Alert,
  Button,
  DataTable,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  TableSkeleton,
  TableToolbar,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SALES_PERMISSIONS } from "../../permissions";
import { useCustomers, useDeleteCustomer } from "../hooks";
import type { Customer, CustomerStatus } from "../types";
import { CustomerInvoiceHistoryDialog } from "./CustomerInvoiceHistoryDialog";
import { CustomerStatementDialog } from "./CustomerStatementDialog";

const PAGE_SIZE = 20;

export function CustomersView() {
  const router = useRouter();
  const canRead = usePermission(SALES_PERMISSIONS.customerRead);
  const canWrite = usePermission(SALES_PERMISSIONS.customerWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.customerDelete);
  const { toast } = useToast();
  const remove = useDeleteCustomer();
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const canSeeInvoices = usePermission(SALES_PERMISSIONS.invoiceRead);
  const [history, setHistory] = useState<Customer | null>(null);
  const [statementFor, setStatementFor] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | CustomerStatus>("");
  const debounced = useDebouncedValue(search.trim(), 300);

  const query = useCustomers({
    page,
    limit: PAGE_SIZE,
    ...(debounced ? { search: debounced } : {}),
    ...(status ? { status } : {}),
  });

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to customers">
        Ask an administrator for the <code>sales.customer.read</code>{" "}
        permission.
      </Alert>
    );
  }

  async function handleDelete() {
    if (!toDelete) return;
    const c = toDelete;
    try {
      await remove.mutateAsync(c.id);
      toast({ title: `${c.companyName} deleted`, variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError &&
          error.errorCode === "CUSTOMER_HAS_DOCUMENTS"
            ? `${c.companyName} has documents and cannot be deleted`
            : `Could not delete ${c.companyName}`,
        variant: "error",
      });
    } finally {
      setToDelete(null);
    }
  }

  const filtered = debounced !== "" || status !== "";
  const newButton = canWrite ? (
    <Button
      variant="secondary"
      onClick={() => router.push("/sales/customers/new")}
    >
      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
      New customer
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Customers"
        description={
          query.data
            ? `Clients you quote, invoice and deliver to • Total: ${query.data.meta.total}`
            : "Clients you quote, invoice and deliver to"
        }
        icon={Building2}
        action={newButton}
      />

      <TableToolbar
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: "Search code, company, contact, GSTIN, city…",
          ariaLabel: "Search customers",
        }}
        filters={
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | CustomerStatus);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        }
        hasActiveFilters={filtered}
        onClearFilters={() => {
          setSearch("");
          setStatus("");
          setPage(1);
        }}
        resultCount={query.data?.meta.total}
      />

      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={6} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to customers">
            Your access has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No customers matched your filters"
            description="Try another search or clear the filters."
          />
        ) : (
          <EmptyState
            title="No customers yet"
            description="Add your first customer to start quoting."
            action={newButton}
          />
        )
      ) : (
        <>
          <DataTable<Customer>
            caption="Customers"
            rows={query.data.data}
            getRowKey={(c) => String(c.id)}
            onRowClick={(c) => router.push(`/sales/customers/${c.id}`)}
            columns={[
              {
                header: "Code",
                align: "center",
                cell: (c) => (
                  <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    {c.customerCode}
                  </span>
                ),
              },
              {
                header: "Company",
                cell: (c) => (
                  <div className="flex flex-col">
                    {canSeeInvoices ? (
                      <button
                        type="button"
                        className="w-fit text-left font-semibold text-brand-700 hover:underline dark:text-brand-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistory(c);
                        }}
                        aria-label={`View invoice history for ${c.companyName}`}
                      >
                        {c.companyName}
                      </button>
                    ) : (
                      <span className="font-semibold text-gray-900 dark:text-white/90">
                        {c.companyName}
                      </span>
                    )}
                  </div>
                ),
              },
              { header: "Contact", cell: (c) => c.contactPerson },
              {
                header: "Email",
                cell: (c) => (
                  <span className="break-all text-gray-600 dark:text-gray-300">
                    {c.email}
                  </span>
                ),
              },
              {
                header: "Phone",
                cell: (c) => `${c.mobileCountryCode} ${c.mobileNumber}`,
              },
              {
                header: "Default address",
                cell: (c) => {
                  const a = c.defaultAddress;
                  const place =
                    [a?.city, a?.stateName ?? c.stateName]
                      .filter(Boolean)
                      .join(", ") || "—";
                  return (
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 dark:text-white/90">
                        {place}
                      </span>
                      {a?.label ? (
                        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                          {a.label}
                        </span>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                header: "GST",
                align: "center",
                cell: (c) =>
                  c.gstin ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pr-3 pl-1 text-theme-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200">
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        {c.gstin.slice(0, 2)}
                      </span>
                      {c.gstin}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Status",
                cell: (c) => (
                  <StatusBadge
                    label={c.status === "ACTIVE" ? "Active" : "Inactive"}
                    colorToken={c.status === "ACTIVE" ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "Actions",
                align: "center",
                cell: (c) => (
                  <ActionMenu
                    triggerIcon="horizontal"
                    ariaLabel={`Actions for ${c.companyName}`}
                    items={[
                      {
                        label: "View details",
                        icon: <Eye className="h-4 w-4" aria-hidden="true" />,
                        onClick: () => router.push(`/sales/customers/${c.id}`),
                      },
                      ...(canSeeInvoices
                        ? [
                            {
                              label: "Invoice history",
                              icon: (
                                <Receipt
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ),
                              onClick: () => setHistory(c),
                            },
                            {
                              label: "Statement",
                              icon: (
                                <FileText
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ),
                              onClick: () => setStatementFor(c),
                            },
                          ]
                        : []),
                      ...(canWrite
                        ? [
                            {
                              label: "Edit customer",
                              icon: (
                                <Pencil
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ),
                              separator: true,
                              onClick: () =>
                                router.push(`/sales/customers/${c.id}/edit`),
                            },
                          ]
                        : []),
                      ...(canDelete
                        ? [
                            {
                              label: "Delete customer",
                              icon: (
                                <Trash2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ),
                              variant: "destructive" as const,
                              separator: !canWrite,
                              onClick: () => setToDelete(c),
                            },
                          ]
                        : []),
                    ]}
                  />
                ),
              },
            ]}
          />
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            totalItems={query.data.meta.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {canDelete ? (
        <DeleteConfirmDialog
          open={toDelete !== null}
          onClose={() => setToDelete(null)}
          onConfirm={handleDelete}
          title="Delete customer"
          itemName={toDelete?.companyName ?? ""}
          description="Customers with quotations, invoices or challans cannot be deleted."
          loading={remove.isPending}
        />
      ) : null}

      <CustomerInvoiceHistoryDialog
        customer={history}
        onClose={() => setHistory(null)}
        onOpenStatement={() => setStatementFor(history)}
      />
      <CustomerStatementDialog
        customer={statementFor}
        onClose={() => setStatementFor(null)}
      />
    </div>
  );
}
