"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Truck,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Alert,
  Button,
  DataTable,
  DateRangePicker,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SectionCard,
  Select,
  Skeleton,
  StatusBadge,
  TableSkeleton,
  TableToolbar,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { BackArrow } from "../../customers/components/CustomerFormView";
import { useCustomers } from "../../customers/hooks";
import { SALES_PERMISSIONS } from "../../permissions";
import { DocumentPdfPanel } from "../../shared/components/DocumentPdfPanel";
import { SendEmailDialog } from "../../shared/components/SendEmailDialog";
import { downloadPdf, pdfFileName, whatsappLink } from "../../shared/documents";
import { formatDate, todayIst } from "../../shared/format";
import { CHALLANS } from "../api";
import {
  useChallan,
  useChallans,
  useCreateChallan,
  useDeleteChallan,
  useUpdateChallan,
} from "../hooks";
import { challanToForm, emptyChallanForm } from "../schema";
import type { DcStatus, DeliveryChallan } from "../types";
import { ChallanForm } from "./ChallanForm";

const LIST = "/sales/delivery-challans";
const PAGE_SIZE = 20;

export function ChallanStatusBadge({ status }: { status: DcStatus }) {
  return status === "DISPATCHED" ? (
    <StatusBadge label="Dispatched" colorToken="success" />
  ) : (
    <StatusBadge label="Draft" colorToken="gray" />
  );
}

function NoAccess({ code, what }: { code: string; what: string }) {
  return (
    <Alert variant="warning" title={`You don't have access to ${what}`}>
      Ask an administrator for the <code>{code}</code> permission.
    </Alert>
  );
}

type RowDialog = "email" | "delete";

export function ChallansView() {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(SALES_PERMISSIONS.deliveryChallanRead);
  const canWrite = usePermission(SALES_PERMISSIONS.deliveryChallanWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.deliveryChallanDelete);
  const canSend = usePermission(SALES_PERMISSIONS.deliveryChallanSend);
  const canPickCustomer = usePermission(SALES_PERMISSIONS.customerRead);
  const remove = useDeleteChallan();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | DcStatus>("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [target, setTarget] = useState<{
    challan: DeliveryChallan;
    dialog: RowDialog;
  } | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const customers = useCustomers({ page: 1, limit: 100 }, canPickCustomer);
  const query = useChallans(
    {
      page,
      limit: PAGE_SIZE,
      ...(debounced ? { search: debounced } : {}),
      ...(status ? { status } : {}),
      ...(customerId ? { customerId: Number(customerId) } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
    canRead,
  );

  if (!canRead) {
    return (
      <NoAccess code="sales.delivery_challan.read" what="delivery challans" />
    );
  }
  const filtered = Boolean(debounced || status || customerId || from || to);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  async function runPdf(d: DeliveryChallan) {
    try {
      await downloadPdf(`${CHALLANS}/${d.id}/pdf`, pdfFileName(d.dcNumber));
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not download the PDF",
        variant: "error",
      });
    }
  }

  async function runWhatsapp(d: DeliveryChallan) {
    try {
      window.open(
        await whatsappLink(`${CHALLANS}/${d.id}/whatsapp`),
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
    const d = target.challan;
    try {
      await remove.mutateAsync(d.id);
      toast({ title: `${d.dcNumber} deleted`, variant: "success" });
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
  const current = target?.challan;
  const cls = "h-4 w-4";
  const newButton = canWrite ? (
    <Button onClick={() => router.push(`${LIST}/new`)}>
      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
      New delivery challan
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Delivery challans"
        description="Dispatch documents without prices; raise one from a tax invoice or directly."
        icon={Truck}
        badge={
          query.data ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {query.data.meta.total} challans
            </span>
          ) : undefined
        }
        action={newButton}
      />
      <TableToolbar
        search={{
          value: search,
          onChange: (v) => reset(() => setSearch(v)),
          placeholder: "Search DC number, customer, prepared by…",
          ariaLabel: "Search delivery challans",
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) =>
                reset(() => setStatus(e.target.value as "" | DcStatus))
              }
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="DISPATCHED">Dispatched</option>
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
        <TableSkeleton rowsCount={6} columnsCount={8} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title={
            filtered
              ? "No challans matched your filters"
              : "No delivery challans yet"
          }
          description={
            filtered
              ? "Try another search or clear the filters."
              : "Create one, or raise one from a tax invoice."
          }
          {...(filtered ? {} : { action: newButton })}
        />
      ) : (
        <>
          <DataTable<DeliveryChallan>
            caption="Delivery challans"
            rows={query.data.data}
            getRowKey={(d) => String(d.id)}
            columns={[
              {
                header: "DC number",
                cell: (d) => (
                  <span className="text-theme-sm font-semibold text-brand-700 dark:text-brand-400">
                    {d.dcNumber}
                  </span>
                ),
              },
              { header: "Date", cell: (d) => formatDate(d.dcDate) },
              {
                header: "Customer",
                cell: (d) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {d.customerSnapshot.companyName}
                    </span>
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {d.customerSnapshot.customerCode}
                    </span>
                  </div>
                ),
              },
              {
                header: "Items",
                align: "right",
                cell: (d) =>
                  `${d.itemsCount} ${d.itemsCount === 1 ? "item" : "items"}`,
              },
              { header: "Prepared by", cell: (d) => d.preparedBy ?? "—" },
              {
                header: "From invoice",
                cell: (d) => d.sourceInvoice?.invoiceNumber ?? "—",
              },
              {
                header: "Status",
                cell: (d) => <ChallanStatusBadge status={d.status} />,
              },
              {
                header: "Actions",
                align: "center",
                cell: (d) => (
                  <ActionMenu
                    triggerIcon="horizontal"
                    ariaLabel={`Actions for ${d.dcNumber}`}
                    items={[
                      {
                        label: "View details",
                        icon: <Eye className={cls} aria-hidden="true" />,
                        onClick: () => router.push(`${LIST}/${d.id}`),
                      },
                      {
                        label: "Download PDF",
                        icon: <Download className={cls} aria-hidden="true" />,
                        onClick: () => void runPdf(d),
                      },
                      ...(canSend
                        ? [
                            {
                              label: "Send mail",
                              icon: <Mail className={cls} aria-hidden="true" />,
                              onClick: () =>
                                setTarget({ challan: d, dialog: "email" }),
                            },
                            {
                              label: "Share WhatsApp",
                              icon: (
                                <Share2 className={cls} aria-hidden="true" />
                              ),
                              onClick: () => void runWhatsapp(d),
                            },
                          ]
                        : []),
                      ...(canWrite
                        ? [
                            {
                              label: "Edit DC",
                              icon: (
                                <Pencil className={cls} aria-hidden="true" />
                              ),
                              separator: true,
                              onClick: () =>
                                router.push(`${LIST}/${d.id}/edit`),
                            },
                          ]
                        : []),
                      ...(canDelete
                        ? [
                            {
                              label: "Delete DC",
                              icon: (
                                <Trash2 className={cls} aria-hidden="true" />
                              ),
                              variant: "destructive" as const,
                              separator: !canWrite,
                              onClick: () =>
                                setTarget({ challan: d, dialog: "delete" }),
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
      {current && canSend ? (
        <SendEmailDialog
          open={target?.dialog === "email"}
          onClose={closeDialog}
          path={`${CHALLANS}/${current.id}/email`}
          documentLabel={`Delivery challan ${current.dcNumber}`}
          customerEmail={current.customerSnapshot.email}
        />
      ) : null}
      {canDelete ? (
        <DeleteConfirmDialog
          open={target?.dialog === "delete"}
          onClose={closeDialog}
          onConfirm={handleDelete}
          title="Delete delivery challan"
          itemName={current?.dcNumber ?? ""}
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}

export function ChallanCreateView() {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.deliveryChallanWrite);
  const create = useCreateChallan();
  if (!canWrite) {
    return (
      <NoAccess
        code="sales.delivery_challan.write"
        what="change delivery challans"
      />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="New delivery challan"
        description="Items and quantities only, with no prices. The preview updates as you type."
        icon={<BackArrow href={LIST} label="Back to delivery challans" />}
      />
      <ChallanForm
        mode="create"
        initialValues={emptyChallanForm(todayIst())}
        onSubmit={async (body) => {
          const dc = await create.mutateAsync(body);
          toast({
            title: `Delivery challan ${dc.dcNumber} saved`,
            variant: "success",
          });
          router.push(`${LIST}/${dc.id}`);
        }}
        onCancel={() => router.push(LIST)}
      />
    </div>
  );
}

export function ChallanEditView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.deliveryChallanWrite);
  const query = useChallan(id);
  const update = useUpdateChallan();
  if (!canWrite) {
    return (
      <NoAccess
        code="sales.delivery_challan.write"
        what="change delivery challans"
      />
    );
  }
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const dc = query.data;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={`Edit ${dc.dcNumber}`}
        description={dc.customerSnapshot.companyName}
        icon={<BackArrow href={`${LIST}/${id}`} label="Back to challan" />}
      />
      <ChallanForm
        key={dc.updatedAt}
        mode="edit"
        challanId={dc.id}
        challanNumber={dc.dcNumber}
        initialValues={challanToForm(dc)}
        customerLabel={`${dc.customerSnapshot.customerCode} — ${dc.customerSnapshot.companyName}`}
        onSubmit={async (body) => {
          await update.mutateAsync({ id, body });
          toast({ title: `${dc.dcNumber} saved`, variant: "success" });
          router.push(`${LIST}/${id}`);
        }}
        onCancel={() => router.push(`${LIST}/${id}`)}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-theme-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right text-gray-900 dark:text-white/90">{value}</dd>
    </div>
  );
}

export function ChallanDetailView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(SALES_PERMISSIONS.deliveryChallanRead);
  const canWrite = usePermission(SALES_PERMISSIONS.deliveryChallanWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.deliveryChallanDelete);
  const canSend = usePermission(SALES_PERMISSIONS.deliveryChallanSend);
  const query = useChallan(canRead ? id : null);
  const remove = useDeleteChallan();
  const [dialog, setDialog] = useState<"email" | "delete" | null>(null);
  const [busy, setBusy] = useState<"pdf" | "whatsapp" | null>(null);

  if (!canRead) {
    return (
      <NoAccess code="sales.delivery_challan.read" what="delivery challans" />
    );
  }
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert variant="warning" title="Delivery challan not found">
        It may have been deleted.
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const dc = query.data;
  const base = `${CHALLANS}/${dc.id}`;

  async function run(kind: "pdf" | "whatsapp") {
    setBusy(kind);
    try {
      if (kind === "pdf") {
        await downloadPdf(`${base}/pdf`, pdfFileName(dc.dcNumber));
      } else {
        window.open(
          await whatsappLink(`${base}/whatsapp`),
          "_blank",
          "noopener",
        );
      }
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "That did not work",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={dc.dcNumber}
        description={`${dc.customerSnapshot.companyName} · ${formatDate(dc.dcDate)}`}
        icon={<BackArrow href={LIST} label="Back to delivery challans" />}
        badge={<ChallanStatusBadge status={dc.status} />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy === "pdf"}
              onClick={() => void run("pdf")}
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Download PDF
            </Button>
            {canSend ? (
              <>
                <Button variant="secondary" onClick={() => setDialog("email")}>
                  <Mail className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Email
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === "whatsapp"}
                  onClick={() => void run("whatsapp")}
                >
                  <MessageCircle
                    className="mr-1.5 h-4 w-4"
                    aria-hidden="true"
                  />
                  WhatsApp
                </Button>
              </>
            ) : null}
            {canWrite ? (
              <Button
                variant="secondary"
                onClick={() => router.push(`${LIST}/${dc.id}/edit`)}
              >
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="destructive" onClick={() => setDialog("delete")}>
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          title="Summary"
          description={`${dc.itemsCount} ${dc.itemsCount === 1 ? "item" : "items"}`}
          className="xl:self-start"
        >
          <dl className="flex flex-col gap-2.5">
            <Fact label="Customer" value={dc.customerSnapshot.companyName} />
            {dc.sourceInvoice ? (
              <Fact
                label="From invoice"
                value={
                  <Link href={`/sales/invoices/${dc.sourceInvoice.id}`}>
                    {dc.sourceInvoice.invoiceNumber}
                  </Link>
                }
              />
            ) : null}
            <Fact label="Items" value={dc.itemsCount} />
            <Fact label="Prepared by" value={dc.preparedBy ?? "—"} />
          </dl>
        </SectionCard>
        <div className="xl:col-span-2">
          <DocumentPdfPanel
            path={`${base}/pdf`}
            version={dc.updatedAt}
            title={`Delivery challan ${dc.dcNumber}`}
          />
        </div>
      </div>
      {canSend ? (
        <SendEmailDialog
          open={dialog === "email"}
          onClose={() => setDialog(null)}
          path={`${base}/email`}
          documentLabel={`Delivery challan ${dc.dcNumber}`}
          customerEmail={dc.customerSnapshot.email}
        />
      ) : null}
      {canDelete ? (
        <DeleteConfirmDialog
          open={dialog === "delete"}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(dc.id);
              toast({ title: `${dc.dcNumber} deleted`, variant: "success" });
              router.push(LIST);
            } catch (e) {
              setDialog(null);
              toast({
                title: e instanceof ApiError ? e.message : "Could not delete",
                variant: "error",
              });
            }
          }}
          title="Delete delivery challan"
          itemName={dc.dcNumber}
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}
