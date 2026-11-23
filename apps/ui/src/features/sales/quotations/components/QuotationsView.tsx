"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Download,
  Eye,
  FileCheck,
  FileText,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  DateRangePicker,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  TableSkeleton,
  TableToolbar,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCustomers } from "../../customers/hooks";
import { SALES_PERMISSIONS } from "../../permissions";
import { ReasonActionDialog } from "../../shared/components/ReasonActionDialog";
import { SendEmailDialog } from "../../shared/components/SendEmailDialog";
import { downloadPdf, pdfFileName, whatsappLink } from "../../shared/documents";
import { formatDate, formatInr } from "../../shared/format";
import { QUOTATIONS } from "../api";
import {
  useDeleteQuotation,
  useMarkQuotationInvoiced,
  useQuotations,
  useReopenQuotation,
} from "../hooks";
import type { Quotation, QuotationStatus } from "../types";
import { ConvertQuotationDialog } from "./ConvertQuotationDialog";
import { QuotationStatusBadge } from "./QuotationDetailView";

const PAGE_SIZE = 20;

type RowDialog = "email" | "convert" | "invoiced" | "reopen" | "delete";

export function QuotationsView() {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(SALES_PERMISSIONS.quotationRead);
  const canWrite = usePermission(SALES_PERMISSIONS.quotationWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.quotationDelete);
  const canSend = usePermission(SALES_PERMISSIONS.quotationSend);
  const canConvert = usePermission(SALES_PERMISSIONS.invoiceWrite);
  const canPickCustomer = usePermission(SALES_PERMISSIONS.customerRead);
  const remove = useDeleteQuotation();
  const markInvoiced = useMarkQuotationInvoiced();
  const reopen = useReopenQuotation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | QuotationStatus>("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [target, setTarget] = useState<{
    quotation: Quotation;
    dialog: RowDialog;
  } | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);

  const customers = useCustomers({ page: 1, limit: 100 }, canPickCustomer);
  const query = useQuotations({
    page,
    limit: PAGE_SIZE,
    ...(debounced ? { search: debounced } : {}),
    ...(status ? { status } : {}),
    ...(customerId ? { customerId: Number(customerId) } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to quotations">
        Ask an administrator for the <code>sales.quotation.read</code>{" "}
        permission.
      </Alert>
    );
  }

  const filtered = Boolean(debounced || status || customerId || from || to);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const newButton = canWrite ? (
    <Button
      variant="secondary"
      onClick={() => router.push("/sales/quotations/new")}
    >
      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
      New quotation
    </Button>
  ) : null;

  async function runPdf(q: Quotation) {
    try {
      await downloadPdf(
        `${QUOTATIONS}/${q.id}/pdf`,
        pdfFileName(q.quotationNumber),
      );
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not download the PDF",
        variant: "error",
      });
    }
  }

  async function runWhatsapp(q: Quotation) {
    try {
      window.open(
        await whatsappLink(`${QUOTATIONS}/${q.id}/whatsapp`),
        "_blank",
        "noopener",
      );
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not open WhatsApp",
        variant: "error",
      });
    }
  }

  async function handleDelete() {
    if (!target) return;
    const q = target.quotation;
    try {
      await remove.mutateAsync(q.id);
      toast({ title: `${q.quotationNumber} deleted`, variant: "success" });
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not delete",
        variant: "error",
      });
    } finally {
      setTarget(null);
    }
  }

  const closeDialog = () => setTarget(null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Quotations"
        description="Quotes to customers; convert one to a proforma or tax invoice"
        icon={FileText}
        badge={
          query.data ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {query.data.meta.total} quotations
            </span>
          ) : undefined
        }
        action={newButton}
      />

      <TableToolbar
        search={{
          value: search,
          onChange: (v) => reset(() => setSearch(v)),
          placeholder: "Search number, customer, prepared by…",
          ariaLabel: "Search quotations",
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) =>
                reset(() => setStatus(e.target.value as "" | QuotationStatus))
              }
            >
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="CONVERTED">Converted</option>
            </Select>
            {canPickCustomer && customers.data ? (
              <Select
                aria-label="Filter by customer"
                value={customerId}
                onChange={(e) => reset(() => setCustomerId(e.target.value))}
              >
                <option value="">All customers</option>
                {customers.data.data.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
            ) : null}
            <DateRangePicker
              value={{ from, to }}
              fromAriaLabel="From date"
              toAriaLabel="To date"
              placeholder="Date range"
              showPresets
              className="sm:w-64"
              onChange={(r) =>
                reset(() => {
                  setFrom(r.from);
                  setTo(r.to);
                })
              }
            />
          </div>
        }
        hasActiveFilters={filtered}
        onClearFilters={() =>
          reset(() => {
            setSearch("");
            setStatus("");
            setCustomerId("");
            setFrom("");
            setTo("");
          })
        }
        resultCount={query.data?.meta.total}
      />

      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={7} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to quotations">
            Your access has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No quotations matched your filters"
            description="Try another search or clear the filters."
          />
        ) : (
          <EmptyState
            title="No quotations yet"
            description="Create your first quotation."
            action={newButton}
          />
        )
      ) : (
        <>
          <DataTable<Quotation>
            caption="Quotations"
            rows={query.data.data}
            getRowKey={(q) => String(q.id)}
            columns={[
              {
                header: "Number",
                cell: (q) => (
                  <span className="text-theme-sm font-semibold text-brand-700 dark:text-brand-400">
                    {q.quotationNumber}
                  </span>
                ),
              },
              {
                header: "Customer",
                cell: (q) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {q.customerSnapshot.companyName}
                    </span>
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {q.customerSnapshot.customerCode}
                    </span>
                  </div>
                ),
              },
              { header: "Date", cell: (q) => formatDate(q.quotationDate) },
              {
                header: "Total",
                align: "right",
                cell: (q) => (
                  <span className="font-semibold">
                    {formatInr(q.totalAmount)}
                  </span>
                ),
              },
              { header: "Prepared by", cell: (q) => q.preparedBy ?? "—" },
              {
                header: "Status",
                cell: (q) => <QuotationStatusBadge status={q.status} />,
              },
              {
                header: "Actions",
                align: "center",
                cell: (q) => {
                  const open = q.status === "OPEN";
                  const cls = "h-4 w-4";
                  return (
                    <ActionMenu
                      triggerIcon="horizontal"
                      ariaLabel={`Actions for ${q.quotationNumber}`}
                      items={[
                        {
                          label: "View details",
                          icon: <Eye className={cls} aria-hidden="true" />,
                          onClick: () =>
                            router.push(`/sales/quotations/${q.id}`),
                        },
                        ...(canSend
                          ? [
                              {
                                label: "Send email",
                                icon: (
                                  <Mail className={cls} aria-hidden="true" />
                                ),
                                onClick: () =>
                                  setTarget({ quotation: q, dialog: "email" }),
                              },
                              {
                                label: "Share WhatsApp",
                                icon: (
                                  <Share2 className={cls} aria-hidden="true" />
                                ),
                                onClick: () => void runWhatsapp(q),
                              },
                            ]
                          : []),
                        ...(canConvert && open
                          ? [
                              {
                                label: "Convert to invoice",
                                icon: (
                                  <ArrowRightLeft
                                    className={cls}
                                    aria-hidden="true"
                                  />
                                ),
                                onClick: () =>
                                  setTarget({
                                    quotation: q,
                                    dialog: "convert",
                                  }),
                              },
                            ]
                          : []),
                        ...(canWrite && open
                          ? [
                              {
                                label: "Mark as invoiced",
                                icon: (
                                  <FileCheck
                                    className={cls}
                                    aria-hidden="true"
                                  />
                                ),
                                onClick: () =>
                                  setTarget({
                                    quotation: q,
                                    dialog: "invoiced",
                                  }),
                              },
                            ]
                          : []),
                        ...(canWrite && !open
                          ? [
                              {
                                label: "Reopen",
                                icon: (
                                  <RotateCcw
                                    className={cls}
                                    aria-hidden="true"
                                  />
                                ),
                                onClick: () =>
                                  setTarget({
                                    quotation: q,
                                    dialog: "reopen",
                                  }),
                              },
                            ]
                          : []),
                        {
                          label: "Export PDF",
                          icon: <Download className={cls} aria-hidden="true" />,
                          onClick: () => void runPdf(q),
                        },
                        ...(canWrite && open
                          ? [
                              {
                                label: "Edit quotation",
                                icon: (
                                  <Pencil className={cls} aria-hidden="true" />
                                ),
                                separator: true,
                                onClick: () =>
                                  router.push(`/sales/quotations/${q.id}/edit`),
                              },
                            ]
                          : []),
                        ...(canDelete && open
                          ? [
                              {
                                label: "Delete quotation",
                                icon: (
                                  <Trash2 className={cls} aria-hidden="true" />
                                ),
                                variant: "destructive" as const,
                                separator: !(canWrite && open),
                                onClick: () =>
                                  setTarget({ quotation: q, dialog: "delete" }),
                              },
                            ]
                          : []),
                      ]}
                    />
                  );
                },
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

      {target && canSend ? (
        <SendEmailDialog
          open={target.dialog === "email"}
          onClose={closeDialog}
          path={`${QUOTATIONS}/${target.quotation.id}/email`}
          documentLabel={`Quotation ${target.quotation.quotationNumber}`}
          customerEmail={target.quotation.customerSnapshot.email}
        />
      ) : null}
      {target && canConvert ? (
        <ConvertQuotationDialog
          open={target.dialog === "convert"}
          onClose={closeDialog}
          quotationId={target.quotation.id}
          quotationNumber={target.quotation.quotationNumber}
        />
      ) : null}
      {target && canWrite && target.dialog === "invoiced" ? (
        <ConfirmDialog
          open
          onClose={closeDialog}
          onConfirm={async () => {
            const q = target.quotation;
            try {
              await markInvoiced.mutateAsync(q.id);
              toast({
                title: `${q.quotationNumber} marked as invoiced`,
                variant: "success",
              });
            } catch (e) {
              toast({
                title:
                  e instanceof ApiError ? e.message : "Could not mark invoiced",
                variant: "error",
              });
            } finally {
              closeDialog();
            }
          }}
          title="Mark as invoiced"
          description={`${target.quotation.quotationNumber} is locked as converted, without creating an invoice here. Use this when the invoice was raised outside the system.`}
          confirmText="Mark as invoiced"
          loading={markInvoiced.isPending}
        />
      ) : null}
      {target && canWrite && target.dialog === "reopen" ? (
        <ReasonActionDialog
          open
          onClose={closeDialog}
          title="Reopen quotation"
          description={`${target.quotation.quotationNumber} becomes open again and can be edited or converted.`}
          reasonLabel="Reason for reopening"
          reasonHint="Recorded on the quotation and in its history."
          placeholder="e.g. Customer asked for a revised quote"
          confirmLabel="Reopen"
          onConfirm={async (reason) => {
            await reopen.mutateAsync({ id: target.quotation.id, reason });
            toast({
              title: `${target.quotation.quotationNumber} is open again`,
              variant: "success",
            });
            closeDialog();
          }}
        />
      ) : null}
      {canDelete ? (
        <DeleteConfirmDialog
          open={target?.dialog === "delete"}
          onClose={closeDialog}
          onConfirm={handleDelete}
          title="Delete quotation"
          itemName={target?.quotation.quotationNumber ?? ""}
          description="Its number stays used; the next quotation gets the next number."
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}
