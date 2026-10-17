"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Mail,
  MessageCircle,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
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
import { DateActionDialog } from "../../shared/components/DateActionDialog";
import { DocumentPdfPanel } from "../../shared/components/DocumentPdfPanel";
import { SendEmailDialog } from "../../shared/components/SendEmailDialog";
import { downloadPdf, pdfFileName, whatsappLink } from "../../shared/documents";
import { formatDate, todayIst } from "../../shared/format";
import { RDCS } from "../api";
import {
  useCreateRdc,
  useDeleteRdc,
  useMarkRdcReturned,
  useRdc,
  useRdcs,
  useReopenRdc,
  useUpdateRdc,
} from "../hooks";
import { emptyRdcForm, rdcToForm } from "../schema";
import type { RdcStatus, ReturnableDc } from "../types";
import { RdcForm } from "./RdcForm";

const LIST = "/sales/returnable-dcs";
const PAGE_SIZE = 20;

/** Issued → "Pending return" (red once overdue); Returned → green. */
export function RdcStatusBadge({ rdc }: { rdc: ReturnableDc }) {
  if (rdc.status === "RETURNED") {
    return <StatusBadge label="Returned" colorToken="success" />;
  }
  return rdc.overdueDays ? (
    <StatusBadge label={`Overdue (${rdc.overdueDays}d)`} colorToken="error" />
  ) : (
    <StatusBadge label="Pending return" colorToken="warning" />
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

export function RdcsView() {
  const router = useRouter();
  const canRead = usePermission(SALES_PERMISSIONS.returnableDcRead);
  const canWrite = usePermission(SALES_PERMISSIONS.returnableDcWrite);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | RdcStatus>("");
  const [month, setMonth] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = useRdcs(
    {
      page,
      limit: PAGE_SIZE,
      ...(debounced ? { search: debounced } : {}),
      ...(status ? { status } : {}),
      ...(month ? { month } : {}),
    },
    canRead,
  );

  if (!canRead) {
    return <NoAccess code="sales.returnable_dc.read" what="returnable DCs" />;
  }
  const filtered = Boolean(debounced || status || month);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const newButton = canWrite ? (
    <Button onClick={() => router.push(`${LIST}/new`)}>
      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
      New returnable DC
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Returnable DCs"
        description="Goods lent for demos, trials or repair, and when they come back."
        icon={PackageCheck}
        action={newButton}
      />
      <TableToolbar
        search={{
          value: search,
          onChange: (v) => reset(() => setSearch(v)),
          placeholder: "Search RDC number, recipient, purpose, taken by…",
          ariaLabel: "Search returnable DCs",
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) =>
                reset(() => setStatus(e.target.value as "" | RdcStatus))
              }
            >
              <option value="">All statuses</option>
              <option value="ISSUED">Pending return</option>
              <option value="RETURNED">Returned</option>
            </Select>
            <Input
              type="month"
              aria-label="Issue month"
              value={month}
              onChange={(e) => reset(() => setMonth(e.target.value))}
            />
          </div>
        }
        hasActiveFilters={filtered}
        onClearFilters={() =>
          reset(() => {
            setSearch("");
            setStatus("");
            setMonth("");
          })
        }
        resultCount={query.data?.meta.total}
      />
      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={7} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title={
            filtered
              ? "No returnable DCs matched your filters"
              : "No returnable DCs yet"
          }
          description={
            filtered
              ? "Try another search or clear the filters."
              : "Create one when goods leave on a returnable basis."
          }
          {...(filtered ? {} : { action: newButton })}
        />
      ) : (
        <>
          <DataTable<ReturnableDc>
            caption="Returnable DCs"
            rows={query.data.data}
            getRowKey={(r) => String(r.id)}
            onRowClick={(r) => router.push(`${LIST}/${r.id}`)}
            columns={[
              {
                header: "RDC number",
                cell: (r) => (
                  <span className="font-mono text-theme-sm font-medium text-gray-900 dark:text-white/90">
                    {r.rdcNumber}
                  </span>
                ),
              },
              { header: "Issued", cell: (r) => formatDate(r.issueDate) },
              {
                header: "Recipient",
                cell: (r) => r.customerSnapshot.companyName,
              },
              { header: "Purpose", cell: (r) => r.purpose },
              { header: "Items", align: "right", cell: (r) => r.itemsCount },
              {
                header: "Expected return",
                cell: (r) => (
                  <span
                    className={
                      r.overdueDays
                        ? "font-semibold text-error-700 dark:text-error-400"
                        : undefined
                    }
                  >
                    {formatDate(r.expectedReturnDate)}
                  </span>
                ),
              },
              { header: "Status", cell: (r) => <RdcStatusBadge rdc={r} /> },
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

export function RdcCreateView() {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.returnableDcWrite);
  const create = useCreateRdc();
  if (!canWrite) {
    return (
      <NoAccess code="sales.returnable_dc.write" what="change returnable DCs" />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={LIST} label="Back to returnable DCs" />
      <PageHeader
        variant="banner"
        title="New returnable DC"
        icon={PackageCheck}
      />
      <RdcForm
        mode="create"
        initialValues={emptyRdcForm(todayIst())}
        onSubmit={async (body) => {
          const rdc = await create.mutateAsync(body);
          toast({
            title: `Returnable DC ${rdc.rdcNumber} saved`,
            variant: "success",
          });
          router.push(`${LIST}/${rdc.id}`);
        }}
        onCancel={() => router.push(LIST)}
      />
    </div>
  );
}

export function RdcEditView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.returnableDcWrite);
  const query = useRdc(id);
  const update = useUpdateRdc();
  if (!canWrite) {
    return (
      <NoAccess code="sales.returnable_dc.write" what="change returnable DCs" />
    );
  }
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const rdc = query.data;
  if (rdc.status === "RETURNED") {
    return (
      <div className="flex flex-col gap-5">
        <BackLink href={`${LIST}/${id}`} label="Back to returnable DC" />
        <Alert variant="info" title={`${rdc.rdcNumber} has been returned`}>
          Reopen it from its page to make changes.
        </Alert>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`${LIST}/${id}`} label="Back to returnable DC" />
      <PageHeader
        variant="banner"
        title={`Edit ${rdc.rdcNumber}`}
        description={rdc.customerSnapshot.companyName}
        icon={PackageCheck}
      />
      <RdcForm
        key={rdc.updatedAt}
        mode="edit"
        rdcId={rdc.id}
        rdcNumber={rdc.rdcNumber}
        initialValues={rdcToForm(rdc)}
        customerLabel={`${rdc.customerSnapshot.customerCode} — ${rdc.customerSnapshot.companyName}`}
        onSubmit={async (body) => {
          await update.mutateAsync({ id, body });
          toast({ title: `${rdc.rdcNumber} saved`, variant: "success" });
          router.push(`${LIST}/${id}`);
        }}
        onCancel={() => router.push(`${LIST}/${id}`)}
      />
    </div>
  );
}

export function RdcDetailView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(SALES_PERMISSIONS.returnableDcRead);
  const canWrite = usePermission(SALES_PERMISSIONS.returnableDcWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.returnableDcDelete);
  const canSend = usePermission(SALES_PERMISSIONS.returnableDcSend);
  const query = useRdc(canRead ? id : null);
  const remove = useDeleteRdc();
  const markReturned = useMarkRdcReturned();
  const reopen = useReopenRdc();
  const [dialog, setDialog] = useState<
    "email" | "delete" | "return" | "reopen" | null
  >(null);
  const [busy, setBusy] = useState<"pdf" | "whatsapp" | null>(null);

  if (!canRead) {
    return <NoAccess code="sales.returnable_dc.read" what="returnable DCs" />;
  }
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert variant="warning" title="Returnable DC not found">
        It may have been deleted.
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const rdc = query.data;
  const base = `${RDCS}/${rdc.id}`;
  const returned = rdc.status === "RETURNED";

  async function run(kind: "pdf" | "whatsapp") {
    setBusy(kind);
    try {
      if (kind === "pdf") {
        await downloadPdf(`${base}/pdf`, pdfFileName(rdc.rdcNumber));
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
      <BackLink href={LIST} label="Back to returnable DCs" />
      <PageHeader
        variant="banner"
        title={rdc.rdcNumber}
        description={`${rdc.customerSnapshot.companyName} · ${formatDate(rdc.issueDate)}`}
        icon={PackageCheck}
        badge={<RdcStatusBadge rdc={rdc} />}
        action={
          <div className="flex flex-wrap gap-2">
            {canWrite && !returned ? (
              <Button onClick={() => setDialog("return")}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Mark returned
              </Button>
            ) : null}
            {canWrite && returned ? (
              <Button variant="secondary" onClick={() => setDialog("reopen")}>
                <Undo2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Reopen
              </Button>
            ) : null}
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
            {canWrite && !returned ? (
              <Button
                variant="secondary"
                onClick={() => router.push(`${LIST}/${rdc.id}/edit`)}
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
      {rdc.overdueDays ? (
        <Alert variant="error" title="Return overdue">
          Expected back on {formatDate(rdc.expectedReturnDate)} —{" "}
          {rdc.overdueDays} day{rdc.overdueDays === 1 ? "" : "s"} late.
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="flex flex-col gap-2 text-theme-sm">
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Summary
          </h2>
          <p>Purpose: {rdc.purpose}</p>
          <p>Expected return: {formatDate(rdc.expectedReturnDate)}</p>
          {rdc.returnedDate ? (
            <p>Returned on: {formatDate(rdc.returnedDate)}</p>
          ) : null}
          <p>Taken by: {rdc.takenBy ?? "—"}</p>
          <p>Items: {rdc.itemsCount}</p>
          <p>Prepared by: {rdc.preparedBy ?? "—"}</p>
        </Card>
        <div className="xl:col-span-2">
          <DocumentPdfPanel
            path={`${base}/pdf`}
            version={rdc.updatedAt}
            title={`Returnable DC ${rdc.rdcNumber}`}
          />
        </div>
      </div>
      {dialog === "return" ? (
        <DateActionDialog
          open
          onClose={() => setDialog(null)}
          title={`Mark ${rdc.rdcNumber} returned`}
          dateLabel="Returned on"
          description="The goods are back. A returned DC is locked; reopen it to edit."
          confirmLabel="Mark returned"
          onConfirm={async (date) => {
            await markReturned.mutateAsync({ id: rdc.id, returnedDate: date });
            toast({ title: `${rdc.rdcNumber} returned`, variant: "success" });
            setDialog(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={dialog === "reopen"}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          try {
            await reopen.mutateAsync(rdc.id);
            toast({
              title: `${rdc.rdcNumber} is pending return again`,
              variant: "success",
            });
          } catch (e) {
            toast({
              title: e instanceof ApiError ? e.message : "Could not reopen",
              variant: "error",
            });
          } finally {
            setDialog(null);
          }
        }}
        title="Reopen returnable DC"
        description={`${rdc.rdcNumber} goes back to pending return and its returned date is cleared.`}
        confirmText="Reopen"
        loading={reopen.isPending}
      />
      {canSend ? (
        <SendEmailDialog
          open={dialog === "email"}
          onClose={() => setDialog(null)}
          path={`${base}/email`}
          documentLabel={`Returnable DC ${rdc.rdcNumber}`}
          customerEmail={rdc.customerSnapshot.email}
        />
      ) : null}
      {canDelete ? (
        <DeleteConfirmDialog
          open={dialog === "delete"}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(rdc.id);
              toast({ title: `${rdc.rdcNumber} deleted`, variant: "success" });
              router.push(LIST);
            } catch (e) {
              setDialog(null);
              toast({
                title: e instanceof ApiError ? e.message : "Could not delete",
                variant: "error",
              });
            }
          }}
          title="Delete returnable DC"
          itemName={rdc.rdcNumber}
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}
