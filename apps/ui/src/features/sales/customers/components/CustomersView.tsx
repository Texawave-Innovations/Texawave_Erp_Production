"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  TableSkeleton,
  TableToolbar,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SALES_PERMISSIONS } from "../../permissions";
import { useCustomers } from "../hooks";
import type { Customer, CustomerStatus } from "../types";

const PAGE_SIZE = 20;

export function CustomersView() {
  const router = useRouter();
  const canRead = usePermission(SALES_PERMISSIONS.customerRead);
  const canWrite = usePermission(SALES_PERMISSIONS.customerWrite);
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

  const filtered = debounced !== "" || status !== "";
  const newButton = canWrite ? (
    <Button onClick={() => router.push("/sales/customers/new")}>
      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
      New customer
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Customers"
        description="Clients you quote, invoice and deliver to."
        icon={Building2}
        badge={
          query.data ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {query.data.meta.total} customers
            </span>
          ) : undefined
        }
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
                cell: (c) => (
                  <span className="font-mono text-theme-sm font-medium text-gray-900 dark:text-white/90">
                    {c.customerCode}
                  </span>
                ),
              },
              {
                header: "Company",
                cell: (c) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {c.companyName}
                    </span>
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {c.contactPerson} · {c.email}
                    </span>
                  </div>
                ),
              },
              {
                header: "Mobile",
                cell: (c) => `${c.mobileCountryCode} ${c.mobileNumber}`,
              },
              {
                header: "GSTIN",
                cell: (c) => (
                  <span className="font-mono text-theme-sm">
                    {c.gstin ?? "—"}
                  </span>
                ),
              },
              {
                header: "Location",
                cell: (c) =>
                  [c.defaultAddress?.city, c.stateName]
                    .filter(Boolean)
                    .join(", ") || "—",
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
    </div>
  );
}
