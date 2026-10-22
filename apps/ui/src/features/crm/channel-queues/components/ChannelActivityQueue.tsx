"use client";

import type { ActivityDirection, CrmActivity } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import { AccountPicker } from "@/features/crm/accounts/components/AccountPicker";
import { useAccounts } from "@/features/crm/accounts/hooks";
import {
  useActivities,
  useCreateActivity,
  useDeleteActivity,
  useUpdateActivity,
} from "@/features/crm/activities/hooks";
import {
  celebrateCrm,
  type CrmCelebrationKey,
} from "@/features/crm/celebration";
import { useContacts } from "@/features/crm/contacts/hooks";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { usePermission } from "@/hooks/usePermission";
import {
  ArrowLeft,
  Eye,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type SVGProps } from "react";
import { toast } from "sonner";
import { linkedInLink, mailLink, waLink } from "../links";

export type ChannelType = "WhatsApp" | "LinkedIn" | "Email";

const DEFAULT_SUBJECT: Record<ChannelType, string> = {
  WhatsApp: "WhatsApp message",
  LinkedIn: "LinkedIn touchpoint",
  Email: "Email",
};

const CELEBRATION_KEY: Record<ChannelType, CrmCelebrationKey> = {
  WhatsApp: "whatsapp.logged",
  LinkedIn: "linkedin.logged",
  Email: "email.logged",
};

/** lucide-react v1 has no brand icons — inline LinkedIn glyph. */
const Linkedin = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const CHANNEL_ICON: Record<ChannelType, LucideIcon> = {
  WhatsApp: MessageCircle,
  LinkedIn: Linkedin as unknown as LucideIcon,
  Email: Mail,
};

interface LogFormState {
  accountId: number | undefined;
  contactId: number | undefined;
  subject: string;
  notes: string;
  direction: ActivityDirection;
}

const HEAD = "font-black text-sm uppercase tracking-wider text-white py-2.5";
const DISABLED_BTN =
  "h-8 px-2 gap-1 text-xs rounded-lg border-slate-200 text-slate-400 shrink-0";

/** Shared operational queue for the WhatsApp / LinkedIn / Email tabs
 * (legacy `domain/ChannelActivityQueue.tsx`). Interaction channels, not
 * customer statuses: each logged touchpoint is a core `CrmActivity` of the
 * channel's type against an existing Account or Contact, so it also shows
 * on that Account's Activities timeline. Never creates an Account. */
export function ChannelActivityQueue({
  activityType,
  title,
  description,
}: {
  activityType: ChannelType;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const Icon = CHANNEL_ICON[activityType];
  const canDelete = usePermission("crm.activity.delete");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmActivity | null>(null);
  const [form, setForm] = useState<LogFormState>({
    accountId: undefined,
    contactId: undefined,
    subject: "",
    notes: "",
    direction: "Sent",
  });
  const [saving, setSaving] = useState(false);

  const query = useActivities({
    type: activityType,
    page,
    limit: pageSize,
    search: search || undefined,
  });
  // Bounded bulk lookups, resolved client-side (same approach as the
  // Cold Calling and status-queue lists).
  const accountsQuery = useAccounts({ limit: 100, order: "asc" });
  const contactsQuery = useContacts({ limit: 100 });
  const formContactsQuery = useContacts({
    accountId: form.accountId,
    limit: 100,
  });
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  const accounts = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data],
  );
  const contacts = useMemo(
    () => contactsQuery.data?.data ?? [],
    [contactsQuery.data],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const contactById = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );

  function resolve(a: CrmActivity) {
    const contactDirect =
      a.relatedType === "contact" ? contactById.get(a.relatedId) : undefined;
    const accountId =
      a.relatedType === "account" ? a.relatedId : contactDirect?.accountId;
    const account =
      accountId !== undefined ? accountById.get(accountId) : undefined;
    // Legacy falls back to the account's primary contact when the activity
    // is account-level.
    const contact =
      contactDirect ??
      (accountId !== undefined
        ? contacts.find((c) => c.accountId === accountId && c.isPrimary)
        : undefined);
    return { account, contact };
  }

  function openLog() {
    setEditing(null);
    setForm({
      accountId: undefined,
      contactId: undefined,
      subject: DEFAULT_SUBJECT[activityType],
      notes: "",
      direction: "Sent",
    });
    setLogOpen(true);
  }

  function openEdit(a: CrmActivity) {
    const { account } = resolve(a);
    setEditing(a);
    setForm({
      accountId: account?.id,
      contactId: a.relatedType === "contact" ? a.relatedId : undefined,
      subject: a.subject,
      notes: a.notes ?? "",
      direction: a.direction ?? "Sent",
    });
    setLogOpen(true);
  }

  function closeLog() {
    setLogOpen(false);
    setEditing(null);
  }

  async function handleSave() {
    if (!editing && !form.accountId) return;
    setSaving(true);
    try {
      const subject = form.subject.trim() || `${activityType} touchpoint`;
      if (editing) {
        await updateActivity.mutateAsync({
          id: editing.id,
          input: {
            subject,
            notes: form.notes,
            ...(activityType === "Email" ? { direction: form.direction } : {}),
          },
        });
        toast.success(`${activityType} updated`);
      } else {
        await createActivity.mutateAsync({
          relatedType: form.contactId ? "contact" : "account",
          relatedId: (form.contactId ?? form.accountId) as number,
          type: activityType,
          subject,
          notes: form.notes || undefined,
          ...(activityType === "Email" ? { direction: form.direction } : {}),
          occurredAt: new Date().toISOString(),
        });
        toast.success(`${activityType} logged`);
        celebrateCrm(CELEBRATION_KEY[activityType]);
      }
      closeLog();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : `Failed to save ${activityType} activity.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: CrmActivity) {
    try {
      await deleteActivity.mutateAsync(a.id);
    } catch {
      throw new Error("Failed to delete entry");
    }
    toast.success(`${activityType} entry deleted`);
  }

  const isEmail = activityType === "Email";
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  if (logOpen) {
    const formContacts = formContactsQuery.data?.data ?? [];
    return (
      <div className="space-y-6 pb-8">
        <div className="flex items-center gap-2 flex-wrap">
          <BackToDashboardButton />
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 -ml-2"
            onClick={() => !saving && closeLog()}
            disabled={saving}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {title}
          </Button>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editing ? `Edit ${activityType}` : `Log ${activityType}`}
              </h2>
              <p className="text-sm text-slate-400">{description}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Account <span className="text-red-500">*</span>
              </Label>
              <AccountPicker
                value={form.accountId}
                disabled={Boolean(editing) || saving}
                placeholder="Select an existing account"
                onChange={(id) =>
                  setForm((f) => ({
                    ...f,
                    accountId: id,
                    contactId: undefined,
                  }))
                }
              />
              <p className="text-sm text-slate-400">
                Don&apos;t see the account? Add it first from the Accounts tab —
                this never creates a new one.
              </p>
            </div>
            {!editing && form.accountId && formContacts.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Contact (optional)
                </Label>
                <Select
                  value={form.contactId ? String(form.contactId) : ""}
                  disabled={saving}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, contactId: Number(v) }))
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue placeholder="Account-level (no specific contact)" />
                  </SelectTrigger>
                  <SelectContent>
                    {formContacts.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isEmail && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Direction
                </Label>
                <Select
                  value={form.direction}
                  disabled={saving}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      direction: v as ActivityDirection,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Subject
              </Label>
              <Input
                value={form.subject}
                disabled={saving}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-bold text-slate-600">
                {isEmail ? "Content / Summary" : "Message / Notes"}
              </Label>
              <Textarea
                rows={3}
                value={form.notes}
                disabled={saving}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-400">
            Fields marked with * are required.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              onClick={closeLog}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={(!editing && !form.accountId) || saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Log Activity"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex flex-row items-center justify-between gap-4 flex-wrap">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative">
            <CardTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Icon className="h-4 w-4 text-brand-600" /> {title}
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              {description}
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={openLog}
            >
              <Plus className="h-4 w-4" /> Log {activityType}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading {title}…
            </div>
          ) : query.isError ? (
            query.error instanceof ApiError && query.error.isPermissionError ? (
              <EmptyState
                icon={Icon}
                title={`You don't have access to ${title}`}
                description="Ask an administrator for the crm.activity.read permission."
              />
            ) : (
              <div className="text-center py-16 text-xs text-red-500">
                Could not load {title}.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void query.refetch()}
                >
                  Retry
                </button>
              </div>
            )
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={
                search
                  ? `No records match "${search}"`
                  : `No ${activityType} activity logged yet`
              }
              description={`Log a ${activityType} touchpoint against an existing Account — it will also appear on that Account's Activity Timeline.`}
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className={HEAD}>Account</TableHead>
                    <TableHead className={HEAD}>Contact</TableHead>
                    {isEmail && (
                      <TableHead className={HEAD}>Direction</TableHead>
                    )}
                    <TableHead className={HEAD}>
                      {isEmail ? "Subject / Summary" : "Message / Note"}
                    </TableHead>
                    <TableHead className={HEAD}>Owner</TableHead>
                    <TableHead className={HEAD}>Date</TableHead>
                    <TableHead
                      className={`${HEAD} text-center w-[280px] whitespace-nowrap`}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {rows.map((a) => {
                    const { account, contact } = resolve(a);
                    const waHref = waLink(
                      contact?.whatsapp || contact?.phone || account?.phone,
                    );
                    const liHref = linkedInLink(account?.linkedin);
                    const mailHref = mailLink(contact?.email || account?.email);
                    return (
                      <TableRow
                        key={a.id}
                        className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                      >
                        <TableCell
                          className={cn("py-1", account && "cursor-pointer")}
                          onClick={() =>
                            account &&
                            router.push(`/crm/accounts/${account.id}`)
                          }
                        >
                          {account?.name || "—"}
                        </TableCell>
                        <TableCell className="text-base text-slate-600 py-1">
                          {contact?.name || "—"}
                        </TableCell>
                        {isEmail && (
                          <TableCell className="text-base py-1">
                            {a.direction ? (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                                  a.direction === "Sent"
                                    ? "bg-sky-50 text-sky-700 border border-sky-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200",
                                )}
                              >
                                {a.direction === "Sent"
                                  ? `Sent → ${contact?.email || account?.email || "contact"}`
                                  : `Received ← ${contact?.email || account?.email || "contact"}`}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        )}
                        <TableCell
                          className="text-base text-slate-600 max-w-[260px] truncate py-1"
                          title={a.notes ?? a.subject}
                        >
                          {a.subject}
                          {a.notes ? ` — ${a.notes}` : ""}
                        </TableCell>
                        <TableCell className="text-base text-slate-600 py-1">
                          {a.createdByName || "—"}
                        </TableCell>
                        <TableCell className="text-base text-slate-600 py-1">
                          {new Date(a.occurredAt).toLocaleString()}
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          className="whitespace-nowrap py-1"
                        >
                          <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                            {account && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs rounded-lg shrink-0 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                onClick={() =>
                                  router.push(`/crm/accounts/${account.id}`)
                                }
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                            )}
                            {activityType === "WhatsApp" &&
                              (waHref ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 gap-1 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 shrink-0"
                                >
                                  <a
                                    href={waHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />{" "}
                                    Chat
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  className={DISABLED_BTN}
                                >
                                  <MessageCircle className="h-3.5 w-3.5" /> Chat
                                </Button>
                              ))}
                            {activityType === "LinkedIn" &&
                              (liHref ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 gap-1 text-xs rounded-lg border-sky-200 text-sky-700 hover:bg-sky-50 shrink-0"
                                >
                                  <a
                                    href={liHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Linkedin className="h-3.5 w-3.5" /> Chat
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  className={DISABLED_BTN}
                                >
                                  <Linkedin className="h-3.5 w-3.5" /> Chat
                                </Button>
                              ))}
                            {isEmail &&
                              (mailHref ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 gap-1 text-xs rounded-lg border-amber-200 text-amber-700 hover:!bg-amber-50 hover:!text-amber-700 hover:!border-amber-200 shrink-0"
                                >
                                  <a
                                    href={mailHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Mail className="h-3.5 w-3.5" /> Compose
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  className={DISABLED_BTN}
                                >
                                  <Mail className="h-3.5 w-3.5" /> Compose
                                </Button>
                              ))}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs font-semibold shrink-0 text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                              title={`Edit ${activityType} entry`}
                              onClick={() => openEdit(a)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            {canDelete && (
                              <DeleteConfirmDialog
                                trigger={
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 gap-1 text-xs font-semibold shrink-0 text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                                    title={`Delete ${activityType} entry`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </Button>
                                }
                                title={`Delete this ${activityType} entry?`}
                                description="This logged activity will be moved to the CRM Recycle Bin."
                                onConfirm={() => handleDelete(a)}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationFooter
            page={meta?.page ?? page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            totalPages={meta?.totalPages ?? 1}
            total={meta?.total ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
