// CRM Core Domain — shared operational-queue view for the WhatsApp / LinkedIn / Email tabs. These
// are interaction channels, not customer statuses (section 8/9 of the CRM brief): each logged
// touchpoint is a Core CRM `CrmActivity` (type "WhatsApp"/"LinkedIn"/"Email") against an existing
// Account or Contact — never a new Account — so it also shows up on that Account's unified
// Activity Timeline and updates Last Touch, with no separate/duplicate dataset.
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { celebrateCrm, CrmCelebrationKey } from "../celebration";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Eye,
  Plus,
  MessageCircle,
  Linkedin,
  Mail,
  Pencil,
  Trash2,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCrmDomainData } from "./useCrmDomainData";
import {
  logCrmActivity,
  updateCrmActivity,
  deleteCrmActivity,
} from "./activitiesService";
import { resolveAccountId } from "./relatedLookup";
import { usePagination, PaginationFooter } from "../components/Pagination";
import { DeleteConfirmDialog, EmptyState } from "../intelligence/components";
import { BackToDashboardButton } from "../components/BackToDashboardButton";
import { CrmActivity, CrmActivityDirection, CrmActivityType } from "./types";
import { isCrmAdmin } from "./roles";

/** Normalizes a stored contact number into a `wa.me` deep link. */
function waLink(phone: string | undefined): string | null {
  const digits = (phone || "").replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/** Normalizes a stored LinkedIn URL/handle into an absolute link, opened as-is in a new tab. */
function linkedInLink(url: string | undefined): string | null {
  const trimmed = (url || "").trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

const CHANNEL_CELEBRATION_KEY: Record<
  "WhatsApp" | "LinkedIn" | "Email",
  CrmCelebrationKey
> = {
  WhatsApp: "whatsapp.logged",
  LinkedIn: "linkedin.logged",
  Email: "email.logged",
};

/** Builds a `mailto:` deep link from a stored email address. */
function mailLink(email: string | undefined): string | null {
  const trimmed = (email || "").trim();
  return trimmed ? `mailto:${trimmed}` : null;
}

export function ChannelActivityQueue({
  activityType,
  title,
  description,
  icon: Icon,
}: {
  activityType: Extract<CrmActivityType, "WhatsApp" | "LinkedIn" | "Email">;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const { accounts, contacts, opportunities, activities, loading } =
    useCrmDomainData();
  const [query, setQuery] = useState("");
  const accountViewState = { from: location.pathname, label: title };

  const [logOpen, setLogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [direction, setDirection] = useState<CrmActivityDirection>("Sent");
  const [saving, setSaving] = useState(false);

  const channelActivities = useMemo(
    () => activities.filter((a) => a.type === activityType),
    [activities, activityType],
  );

  const enriched = useMemo(() => {
    return channelActivities.map((a) => {
      const resolvedAccountId = resolveAccountId(
        a.relatedType,
        a.relatedId,
        contacts,
        opportunities,
      );
      const account = accounts.find((acc) => acc.id === resolvedAccountId);
      const contact =
        a.relatedType === "contact"
          ? contacts.find((c) => c.id === a.relatedId)
          : contacts.find(
              (c) => c.accountId === resolvedAccountId && c.isPrimary,
            );
      return { activity: a, account, contact };
    });
  }, [channelActivities, accounts, contacts, opportunities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((r) =>
      [
        r.account?.name,
        r.contact?.name,
        r.activity.subject,
        r.activity.notes,
        r.activity.createdBy,
      ]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [enriched, query]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

  const accountContacts = useMemo(
    () => contacts.filter((c) => c.accountId === accountId),
    [contacts, accountId],
  );

  const openLogDialog = () => {
    setEditingId(null);
    setAccountId("");
    setContactId("");
    setSubject(
      activityType === "WhatsApp"
        ? "WhatsApp message"
        : activityType === "LinkedIn"
          ? "LinkedIn touchpoint"
          : "Email",
    );
    setNotes("");
    setDirection("Sent");
    setLogOpen(true);
  };

  const openEditDialog = (a: CrmActivity, resolvedAccountId?: string) => {
    setEditingId(a.id);
    setAccountId(resolvedAccountId || "");
    setContactId(a.relatedType === "contact" ? a.relatedId : "");
    setSubject(a.subject);
    setNotes(a.notes || "");
    setDirection(a.direction || "Sent");
    setLogOpen(true);
  };

  const handleLog = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      const payload = {
        relatedType: (contactId ? "contact" : "account") as
          "contact" | "account",
        relatedId: contactId || accountId,
        subject: subject.trim() || `${activityType} touchpoint`,
        notes,
        ...(activityType === "Email" ? { direction } : {}),
      };
      if (editingId) {
        await updateCrmActivity(editingId, payload, user);
        toast.success(`${activityType} updated`);
      } else {
        await logCrmActivity({
          ...payload,
          type: activityType,
          occurredAt: Date.now(),
          createdBy: currentUser,
        });
        toast.success(`${activityType} logged`);
        celebrateCrm(CHANNEL_CELEBRATION_KEY[activityType]);
      }
      setLogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to save ${activityType} activity.`;
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (logOpen) {
    const backButton =
      location.state &&
      (location.state as { fromCrmDashboard?: boolean }).fromCrmDashboard ? (
        <BackToDashboardButton />
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={() => {
            if (!saving) {
              setLogOpen(false);
              setEditingId(null);
            }
          }}
          disabled={saving}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {title}
        </Button>
      );

    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? `Edit ${activityType}` : `Log ${activityType}`}
              </h2>
              <p className="text-sm text-slate-400">{description}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Account <span className="text-red-500">*</span>
              </Label>
              <Select
                value={accountId}
                onValueChange={(v) => {
                  setAccountId(v);
                  setContactId("");
                }}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Select an existing account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-400">
                Don't see the account? Add it first from the Accounts tab — this
                never creates a new one.
              </p>
            </div>
            {accountId && accountContacts.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Contact (optional)
                </Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue placeholder="Account-level (no specific contact)" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activityType === "Email" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  Direction
                </Label>
                <Select
                  value={direction}
                  onValueChange={(v) => setDirection(v as CrmActivityDirection)}
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
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-bold text-slate-600">
                {activityType === "Email"
                  ? "Content / Summary"
                  : "Message / Notes"}
              </Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
              onClick={() => {
                setLogOpen(false);
                setEditingId(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={!accountId || saving}
              onClick={handleLog}
            >
              {saving ? "Saving…" : editingId ? "Save Changes" : "Log Activity"}
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={openLogDialog}
            >
              <Plus className="h-4 w-4" /> Log {activityType}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading {title}…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={
                query
                  ? `No records match "${query}"`
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
                      "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Account
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Contact
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Owner
                    </TableHead>
                    {activityType === "Email" && (
                      <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                        Direction
                      </TableHead>
                    )}
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      {activityType === "Email"
                        ? "Subject / Summary"
                        : "Message / Note"}
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Date
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-[280px] whitespace-nowrap py-2.5">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map(({ activity: a, account, contact }) => (
                    <TableRow
                      key={a.id}
                      className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                    >
                      <TableCell
                        className={cn("py-1", account ? "cursor-pointer" : "")}
                        onClick={() =>
                          account &&
                          navigate(`/crm/accounts/${account.id}`, {
                            state: accountViewState,
                          })
                        }
                      >
                        {account?.name || "—"}
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {contact?.name || "—"}
                      </TableCell>
                      <TableCell className="text-base text-slate-600 py-1">
                        {a.createdBy}
                      </TableCell>
                      {activityType === "Email" && (
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
                        title={a.notes || a.subject}
                      >
                        {a.subject}
                        {a.notes ? ` — ${a.notes}` : ""}
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
                                navigate(`/crm/accounts/${account.id}`, {
                                  state: accountViewState,
                                })
                              }
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                          )}
                          {activityType === "WhatsApp" &&
                            (waLink(
                              contact?.whatsapp ||
                                contact?.phone ||
                                account?.phone,
                            ) ? (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 shrink-0"
                              >
                                <a
                                  href={waLink(
                                    contact?.whatsapp ||
                                      contact?.phone ||
                                      account?.phone,
                                  )!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" /> Chat
                                </a>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="h-8 px-2 gap-1 text-xs rounded-lg border-slate-200 text-slate-400 shrink-0"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> Chat
                              </Button>
                            ))}
                          {activityType === "LinkedIn" &&
                            (linkedInLink(account?.linkedin) ? (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs rounded-lg border-sky-200 text-sky-700 hover:bg-sky-50 shrink-0"
                              >
                                <a
                                  href={linkedInLink(account?.linkedin)!}
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
                                className="h-8 px-2 gap-1 text-xs rounded-lg border-slate-200 text-slate-400 shrink-0"
                              >
                                <Linkedin className="h-3.5 w-3.5" /> Chat
                              </Button>
                            ))}
                          {activityType === "Email" &&
                            (mailLink(contact?.email || account?.email) ? (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs rounded-lg border-amber-200 text-amber-700 hover:!bg-amber-50 hover:!text-amber-700 hover:!border-amber-200 shrink-0"
                              >
                                <a
                                  href={mailLink(
                                    contact?.email || account?.email,
                                  )!}
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
                                className="h-8 px-2 gap-1 text-xs rounded-lg border-slate-200 text-slate-400 shrink-0"
                              >
                                <Mail className="h-3.5 w-3.5" /> Compose
                              </Button>
                            ))}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold shrink-0 text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                            title={`Edit ${activityType} entry`}
                            onClick={() => openEditDialog(a, account?.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          {isCrmAdmin(user) && (
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
                              onConfirm={() =>
                                deleteCrmActivity(a.id, a.subject, user)
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationFooter
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalPages={totalPages}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
