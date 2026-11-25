"use client";

import { salesTabHref } from "@/features/sales/shared/tabs";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Eye,
  Mail,
  MessageCircle,
  PackageCheck,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Undo2,
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
} from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { BackArrow } from "../../customers/components/CustomerFormView";
import { useCustomers } from "../../customers/hooks";
import { SALES_PERMISSIONS } from "../../permissions";
import { DateActionDialog } from "../../shared/components/DateActionDialog";
import { DocumentPdfPanel } from "../../shared/components/DocumentPdfPanel";
import { ReasonActionDialog } from "../../shared/components/ReasonActionDialog";
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
    <Alert
      dismissible
      variant="warning"
      title={`You don't have access to ${what}`}
    >
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

type RowDialog = "email" | "delete" | "return" | "reopen";

export function RdcsView() {
  const router = useRouter();
  const { notify, notifyError } = useNotify();
  const canRead = usePermission(SALES_PERMISSIONS.returnableDcRead);
  const canWrite = usePermission(SALES_PERMISSIONS.returnableDcWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.returnableDcDelete);
  const canSend = usePermission(SALES_PERMISSIONS.returnableDcSend);
  const canPickCustomer = usePermission(SALES_PERMISSIONS.customerRead);
  const remove = useDeleteRdc();
  const markReturned = useMarkRdcReturned();
  const reopen = useReopenRdc();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | RdcStatus>("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [target, setTarget] = useState<{
    rdc: ReturnableDc;
    dialog: RowDialog;
  } | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const customers = useCustomers({ page: 1, limit: 100 }, canPickCustomer);
  const query = useRdcs(
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
    return <NoAccess code="sales.returnable_dc.read" what="returnable DCs" />;
  }
  const filtered = Boolean(debounced || status || customerId || from || to);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  async function runPdf(r: ReturnableDc) {
    try {
      await downloadPdf(`${RDCS}/${r.id}/pdf`, pdfFileName(r.rdcNumber));
    } catch (e) {
      notifyError(e, "sales.document.pdfFailed");
    }
  }

  async function runWhatsapp(r: ReturnableDc) {
    try {
      window.open(
        await whatsappLink(`${RDCS}/${r.id}/whatsapp`),
        "_blank",
        "noopener",
      );
    } catch (e) {
      notifyError(e, "sales.document.whatsappFailed");
    }
  }

  async function handleDelete() {
    if (!target) return;
    const r = target.rdc;
    try {
      await remove.mutateAsync(r.id);
      notify("sales.document.deleted", { number: r.rdcNumber });
    } catch (e) {
      notifyError(e, "sales.document.deleteFailed");
    } finally {
      setTarget(null);
    }
  }

  const closeDialog = () => setTarget(null);
  const current = target?.rdc;
  const cls = "h-4 w-4";
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
        badge={
          query.data ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {query.data.meta.total} returnable DCs
            </span>
          ) : undefined
        }
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
              fromAriaLabel="Issued from"
              toAriaLabel="Issued to"
              placeholder="Issue date range"
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
        <TableSkeleton rowsCount={6} columnsCount={9} />
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
            columns={[
              {
                header: "RDC number",
                cell: (r) => (
                  <span className="text-theme-sm font-semibold text-brand-700 dark:text-brand-400">
                    {r.rdcNumber}
                  </span>
                ),
              },
              { header: "Issued", cell: (r) => formatDate(r.issueDate) },
              {
                header: "Recipient",
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {r.customerSnapshot.companyName}
                    </span>
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {r.customerSnapshot.customerCode}
                    </span>
                  </div>
                ),
              },
              { header: "Purpose", cell: (r) => r.purpose },
              {
                header: "Items",
                align: "right",
                cell: (r) =>
                  `${r.itemsCount} ${r.itemsCount === 1 ? "item" : "items"}`,
              },
              { header: "Prepared by", cell: (r) => r.preparedBy ?? "—" },
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
              {
                header: "Actions",
                align: "center",
                cell: (r) => (
                  <ActionMenu
                    triggerIcon="horizontal"
                    ariaLabel={`Actions for ${r.rdcNumber}`}
                    items={[
                      {
                        label: "View details",
                        icon: <Eye className={cls} aria-hidden="true" />,
                        onClick: () => router.push(`${LIST}/${r.id}`),
                      },
                      {
                        label: "Download PDF",
                        icon: <Download className={cls} aria-hidden="true" />,
                        onClick: () => void runPdf(r),
                      },
                      ...(canSend
                        ? [
                            {
                              label: "Send mail",
                              icon: <Mail className={cls} aria-hidden="true" />,
                              onClick: () =>
                                setTarget({ rdc: r, dialog: "email" }),
                            },
                            {
                              label: "Share WhatsApp",
                              icon: (
                                <Share2 className={cls} aria-hidden="true" />
                              ),
                              onClick: () => void runWhatsapp(r),
                            },
                          ]
                        : []),
                      ...(canWrite && r.status === "ISSUED"
                        ? [
                            {
                              label: "Mark returned",
                              icon: (
                                <CheckCircle2
                                  className={cls}
                                  aria-hidden="true"
                                />
                              ),
                              onClick: () =>
                                setTarget({ rdc: r, dialog: "return" }),
                            },
                          ]
                        : []),
                      ...(canWrite && r.status === "RETURNED"
                        ? [
                            {
                              label: "Reopen",
                              icon: (
                                <Undo2 className={cls} aria-hidden="true" />
                              ),
                              onClick: () =>
                                setTarget({ rdc: r, dialog: "reopen" }),
                            },
                          ]
                        : []),
                      ...(canWrite && r.status === "ISSUED"
                        ? [
                            {
                              label: "Edit RDC",
                              icon: (
                                <Pencil className={cls} aria-hidden="true" />
                              ),
                              separator: true,
                              onClick: () =>
                                router.push(`${LIST}/${r.id}/edit`),
                            },
                          ]
                        : []),
                      ...(canDelete
                        ? [
                            {
                              label: "Delete RDC",
                              icon: (
                                <Trash2 className={cls} aria-hidden="true" />
                              ),
                              variant: "destructive" as const,
                              separator: !(canWrite && r.status === "ISSUED"),
                              onClick: () =>
                                setTarget({ rdc: r, dialog: "delete" }),
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
      {current && target?.dialog === "return" ? (
        <DateActionDialog
          open
          onClose={closeDialog}
          title={`Mark ${current.rdcNumber} returned`}
          dateLabel="Returned on"
          description="The goods are back. A returned DC is locked; reopen it to edit."
          confirmLabel="Mark returned"
          onConfirm={async (date) => {
            await markReturned.mutateAsync({
              id: current.id,
              returnedDate: date,
            });
            notify("sales.rdc.returned", { number: current.rdcNumber });
            closeDialog();
          }}
        />
      ) : null}
      {current && target?.dialog === "reopen" ? (
        <ReasonActionDialog
          open
          onClose={closeDialog}
          title="Reopen returnable DC"
          description={`${current.rdcNumber} goes back to pending return and its returned date is cleared.`}
          reasonLabel="Reason for reopening"
          reasonHint="Recorded on the RDC and in its history."
          placeholder="e.g. Marked returned by mistake"
          confirmLabel="Reopen"
          onConfirm={async (reason) => {
            await reopen.mutateAsync({ id: current.id, reason });
            notify("sales.rdc.pendingAgain", { number: current.rdcNumber });
            closeDialog();
          }}
        />
      ) : null}
      {current && canSend ? (
        <SendEmailDialog
          open={target?.dialog === "email"}
          onClose={closeDialog}
          path={`${RDCS}/${current.id}/email`}
          documentLabel={`Returnable DC ${current.rdcNumber}`}
          customerEmail={current.customerSnapshot.email}
        />
      ) : null}
      {canDelete ? (
        <DeleteConfirmDialog
          open={target?.dialog === "delete"}
          onClose={closeDialog}
          onConfirm={handleDelete}
          title="Delete returnable DC"
          itemName={current?.rdcNumber ?? ""}
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}

export function RdcCreateView() {
  const router = useRouter();
  const { notify } = useNotify();
  const canWrite = usePermission(SALES_PERMISSIONS.returnableDcWrite);
  const create = useCreateRdc();
  if (!canWrite) {
    return (
      <NoAccess code="sales.returnable_dc.write" what="change returnable DCs" />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="New returnable DC"
        description="Goods lent out and expected back. The preview updates as you type."
        icon={
          <BackArrow
            href={salesTabHref("returnable-dcs")}
            label="Back to returnable DCs"
          />
        }
      />
      <RdcForm
        mode="create"
        initialValues={emptyRdcForm(todayIst())}
        onSubmit={async (body) => {
          const rdc = await create.mutateAsync(body);
          notify("sales.document.saved", {
            label: "Returnable DC",
            number: rdc.rdcNumber,
          });
          router.push(`${LIST}/${rdc.id}`);
        }}
        onCancel={() => router.push(salesTabHref("returnable-dcs"))}
      />
    </div>
  );
}

export function RdcEditView({ id }: { id: number }) {
  const router = useRouter();
  const { notify } = useNotify();
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
        <Alert
          dismissible
          variant="info"
          title={`${rdc.rdcNumber} has been returned`}
        >
          Reopen it from its page to make changes.
        </Alert>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={`Edit ${rdc.rdcNumber}`}
        description={rdc.customerSnapshot.companyName}
        icon={
          <BackArrow href={`${LIST}/${id}`} label="Back to returnable DC" />
        }
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
          notify("sales.document.saved", {
            label: "Returnable DC",
            number: rdc.rdcNumber,
          });
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

export function RdcDetailView({ id }: { id: number }) {
  const router = useRouter();
  const { notify, notifyError } = useNotify();
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
      <Alert dismissible variant="warning" title="Returnable DC not found">
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
      notifyError(e, "sales.document.actionFailed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={rdc.rdcNumber}
        description={`${rdc.customerSnapshot.companyName} · ${formatDate(rdc.issueDate)}`}
        icon={
          <BackArrow
            href={salesTabHref("returnable-dcs")}
            label="Back to returnable DCs"
          />
        }
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
        <SectionCard
          title="Summary"
          description={`${rdc.itemsCount} ${rdc.itemsCount === 1 ? "item" : "items"}`}
          className="xl:self-start"
        >
          <dl className="flex flex-col gap-2.5">
            <Fact label="Recipient" value={rdc.customerSnapshot.companyName} />
            <Fact label="Purpose" value={rdc.purpose} />
            <Fact
              label="Expected return"
              value={formatDate(rdc.expectedReturnDate)}
            />
            {rdc.returnedDate ? (
              <Fact label="Returned on" value={formatDate(rdc.returnedDate)} />
            ) : null}
            <Fact label="Taken by" value={rdc.takenBy ?? "—"} />
            <Fact label="Items" value={rdc.itemsCount} />
            <Fact label="Prepared by" value={rdc.preparedBy ?? "—"} />
            {rdc.reopenReason ? (
              <Fact label="Reopened because" value={rdc.reopenReason} />
            ) : null}
          </dl>
        </SectionCard>
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
            notify("sales.rdc.returned", { number: rdc.rdcNumber });
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "reopen" ? (
        <ReasonActionDialog
          open
          onClose={() => setDialog(null)}
          title="Reopen returnable DC"
          description={`${rdc.rdcNumber} goes back to pending return and its returned date is cleared.`}
          reasonLabel="Reason for reopening"
          reasonHint="Recorded on the RDC and in its history."
          placeholder="e.g. Marked returned by mistake"
          confirmLabel="Reopen"
          onConfirm={async (reason) => {
            await reopen.mutateAsync({ id: rdc.id, reason });
            notify("sales.rdc.pendingAgain", { number: rdc.rdcNumber });
            setDialog(null);
          }}
        />
      ) : null}
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
              notify("sales.document.deleted", { number: rdc.rdcNumber });
              router.push(salesTabHref("returnable-dcs"));
            } catch (e) {
              setDialog(null);
              notifyError(e, "sales.document.deleteFailed");
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
