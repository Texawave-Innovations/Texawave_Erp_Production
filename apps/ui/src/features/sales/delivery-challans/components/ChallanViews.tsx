"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DatePicker,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  TableSkeleton,
  TableToolbar,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    >
      ← {label}
    </Link>
  );
}

export function ChallansView() {
  const router = useRouter();
  const canRead = usePermission(SALES_PERMISSIONS.deliveryChallanRead);
  const canWrite = usePermission(SALES_PERMISSIONS.deliveryChallanWrite);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | DcStatus>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = useChallans(
    {
      page,
      limit: PAGE_SIZE,
      ...(debounced ? { search: debounced } : {}),
      ...(status ? { status } : {}),
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
  const filtered = Boolean(debounced || status || from || to);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
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
            <DatePicker
              aria-label="From date"
              value={from}
              onChange={(e) => reset(() => setFrom(e.target.value))}
            />
            <DatePicker
              aria-label="To date"
              value={to}
              min={from || undefined}
              onChange={(e) => reset(() => setTo(e.target.value))}
            />
          </div>
        }
        hasActiveFilters={filtered}
        onClearFilters={() =>
          reset(() => {
            setSearch("");
            setStatus("");
            setFrom("");
            setTo("");
          })
        }
        resultCount={query.data?.meta.total}
      />
      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={6} />
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
            onRowClick={(d) => router.push(`${LIST}/${d.id}`)}
            columns={[
              {
                header: "DC number",
                cell: (d) => (
                  <span className="font-mono text-theme-sm font-medium text-gray-900 dark:text-white/90">
                    {d.dcNumber}
                  </span>
                ),
              },
              { header: "Date", cell: (d) => formatDate(d.dcDate) },
              {
                header: "Customer",
                cell: (d) => d.customerSnapshot.companyName,
              },
              { header: "Items", align: "right", cell: (d) => d.itemsCount },
              {
                header: "From invoice",
                cell: (d) => d.sourceInvoice?.invoiceNumber ?? "—",
              },
              {
                header: "Status",
                cell: (d) => <ChallanStatusBadge status={d.status} />,
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
      <BackLink href={LIST} label="Back to delivery challans" />
      <PageHeader variant="banner" title="New delivery challan" icon={Truck} />
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
      <BackLink href={`${LIST}/${id}`} label="Back to challan" />
      <PageHeader
        variant="banner"
        title={`Edit ${dc.dcNumber}`}
        description={dc.customerSnapshot.companyName}
        icon={Truck}
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
      <BackLink href={LIST} label="Back to delivery challans" />
      <PageHeader
        variant="banner"
        title={dc.dcNumber}
        description={`${dc.customerSnapshot.companyName} · ${formatDate(dc.dcDate)}`}
        icon={Truck}
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
        <Card className="flex flex-col gap-2 text-theme-sm">
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Summary
          </h2>
          <p>Items: {dc.itemsCount}</p>
          {dc.sourceInvoice ? (
            <p>
              From invoice{" "}
              <Link href={`/sales/invoices/${dc.sourceInvoice.id}`}>
                {dc.sourceInvoice.invoiceNumber}
              </Link>
            </p>
          ) : null}
          <p>Prepared by: {dc.preparedBy ?? "—"}</p>
        </Card>
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
