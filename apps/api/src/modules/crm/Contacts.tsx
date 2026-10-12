// CRM Core Domain — global Contacts list. New top-nav tab. Contacts already exist per-Account
// (`AccountDetail.tsx`'s Contacts tab) — this page is the same `crm/contacts` collection viewed
// and managed across every account at once, for when you need to find/edit a person without
// first navigating into their account.
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { celebrateCrm } from "./celebration";
import {
  ArrowLeft,
  Eye,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import {
  createCrmContact,
  updateCrmContact,
  deleteCrmContact,
} from "./domain/contactsService";
import { CrmContactInput } from "./domain/types";
import { DeleteConfirmDialog, EmptyState } from "./intelligence/components";
import { isCrmAdmin } from "./domain/roles";
import { ImportExportBar } from "./importExport/ImportExportBar";
import {
  FieldSchema,
  MappedImportRow,
  DuplicateStrategy,
} from "./importExport/types";
import {
  commitFirebaseImport,
  logBulkImportAudit,
} from "./importExport/commitHelpers";
import { CRM_CONTACTS_PATH } from "./domain/config";
import { CrmAccount, CrmContact } from "./domain/types";
import { usePagination, PaginationFooter } from "./components/Pagination";
import { BackToDashboardButton } from "./components/BackToDashboardButton";

function buildContactFields(accounts: CrmAccount[]): FieldSchema<CrmContact>[] {
  return [
    {
      key: "accountId",
      label: "Account",
      required: true,
      aliases: ["Account Name", "Company", "Company Name"],
      exportValue: (r) =>
        accounts.find((a) => a.id === r.accountId)?.name || "",
      relation: {
        label: "Account",
        required: true,
        lookup: (raw) =>
          accounts.find(
            (a) => a.name.trim().toLowerCase() === raw.trim().toLowerCase(),
          )?.id,
      },
    },
    {
      key: "name",
      label: "Full Name",
      required: true,
      aliases: ["Contact Name"],
    },
    { key: "designation", label: "Designation" },
    { key: "department", label: "Department" },
    { key: "email", label: "Email", type: "email", aliases: ["Email ID"] },
    {
      key: "phone",
      label: "Phone",
      aliases: ["Contact Number", "Mobile Number"],
    },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "isPrimary", label: "Primary Contact", type: "boolean" },
    { key: "isDecisionMaker", label: "Decision Maker", type: "boolean" },
  ];
}

const emptyForm = (accountId: string, createdBy: string): CrmContactInput => ({
  accountId,
  name: "",
  designation: "",
  department: "",
  email: "",
  phone: "",
  whatsapp: "",
  isPrimary: false,
  isDecisionMaker: false,
  createdBy,
});

export default function Contacts() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromDashboard = !!(
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const { accounts, contacts, opportunities, quotations, loading } =
    useCrmDomainData();

  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CrmContactInput>(emptyForm("", currentUser));
  const [saving, setSaving] = useState(false);

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "Unknown Account";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (accountFilter !== "ALL" && c.accountId !== accountFilter)
        return false;
      if (!q) return true;
      return [c.name, c.designation, c.email, c.phone, accountName(c.accountId)]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q));
    });
  }, [contacts, query, accountFilter, accounts]);

  const { paged, page, setPage, pageSize, setPageSize, totalPages, total } =
    usePagination(filtered);

  // Precomputed once (one pass each) instead of every visible row re-scanning the full
  // opportunities/quotations arrays on every render, including every keystroke in the search box.
  const opportunityCountByContact = useMemo(() => {
    const map = new Map<string, number>();
    opportunities.forEach((o) => {
      if (o.contactId) map.set(o.contactId, (map.get(o.contactId) || 0) + 1);
    });
    return map;
  }, [opportunities]);
  const quotationCountByContact = useMemo(() => {
    const map = new Map<string, number>();
    quotations.forEach((q) => {
      if (q.contactId) map.set(q.contactId, (map.get(q.contactId) || 0) + 1);
    });
    return map;
  }, [quotations]);

  const relatedFor = (contactId: string) => ({
    opportunities: opportunityCountByContact.get(contactId) || 0,
    quotations: quotationCountByContact.get(contactId) || 0,
  });

  const contactFields = useMemo(() => buildContactFields(accounts), [accounts]);

  const commitContactsImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      CRM_CONTACTS_PATH,
      importRows,
      strategy,
      (row) => {
        if (row.isDuplicate && strategy === "update")
          return { ...row.data, updatedAt: Date.now() };
        return {
          ...row.data,
          isPrimary: !!row.data.isPrimary,
          isDecisionMaker: !!row.data.isDecisionMaker,
          createdBy: currentUser,
          createdAt: Date.now(),
        };
      },
    );
    await logBulkImportAudit("contact", "Contacts", summary, currentUser);
    return summary;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(accounts[0]?.id || "", currentUser));
    setDialogOpen(true);
  };

  const openEdit = (c: CrmContact) => {
    setEditingId(c.id);
    setForm({
      accountId: c.accountId,
      name: c.name,
      designation: c.designation || "",
      department: c.department || "",
      email: c.email || "",
      phone: c.phone || "",
      whatsapp: c.whatsapp || "",
      isPrimary: !!c.isPrimary,
      isDecisionMaker: !!c.isDecisionMaker,
      createdBy: c.createdBy,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.accountId) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateCrmContact(editingId, form, currentUser);
        toast.success("Contact updated");
      } else {
        await createCrmContact({ ...form, createdBy: currentUser });
        toast.success("Contact created");
        celebrateCrm("contact.created");
      }
      setDialogOpen(false);
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save Contact:", err);
      toast.error("Failed to save contact. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (dialogOpen) {
    const backButton = fromDashboard ? (
      <BackToDashboardButton />
    ) : (
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={() => {
          setDialogOpen(false);
          setEditingId(null);
        }}
        disabled={saving}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Contacts
      </Button>
    );

    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Edit Contact" : "Add Contact"}
              </h2>
              <p className="text-sm text-slate-400">
                Every person across every Account, in one place.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Account *
              </Label>
              <Select
                value={form.accountId}
                onValueChange={(v) => setForm((f) => ({ ...f, accountId: v }))}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Full Name *
              </Label>
              <Input
                className="h-9 rounded-xl"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Designation
              </Label>
              <Input
                className="h-9 rounded-xl"
                value={form.designation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, designation: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                Department
              </Label>
              <Input
                className="h-9 rounded-xl"
                value={form.department}
                onChange={(e) =>
                  setForm((f) => ({ ...f, department: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Email</Label>
              <Input
                className="h-9 rounded-xl"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">Phone</Label>
              <Input
                className="h-9 rounded-xl"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.isPrimary}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isPrimary: !!v }))
                }
              />
              <Label className="text-sm font-normal">Primary Contact</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.isDecisionMaker}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isDecisionMaker: !!v }))
                }
              />
              <Label className="text-sm font-normal">Decision Maker</Label>
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
                setDialogOpen(false);
                setEditingId(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.accountId || saving}
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save Changes"
                  : "Create Contact"}
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
              <Users className="h-4 w-4 text-brand-600" /> Contacts
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Every person across every Account, in one place.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap">
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-9 rounded-xl w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <ImportExportBar
              moduleLabel="Contacts"
              fields={contactFields}
              allRecords={contacts}
              filteredRecords={filtered}
              fileBaseName="crm-contacts"
              duplicate={{
                keys: ["accountId", "email"],
                findExisting: (mapped) => {
                  const accountId = String(mapped.accountId || "").trim();
                  const email = String(mapped.email || "")
                    .trim()
                    .toLowerCase();
                  if (!accountId || !email) return undefined;
                  const match = contacts.find(
                    (c) =>
                      c.accountId === accountId &&
                      (c.email || "").trim().toLowerCase() === email,
                  );
                  return match
                    ? { id: match.id, label: match.name }
                    : undefined;
                },
              }}
              commitImport={commitContactsImport}
            />
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              disabled={accounts.length === 0}
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" /> Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Contacts…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={query ? `No contacts match "${query}"` : "No contacts yet"}
              description="Add a contact here, or from inside an Account's Contacts tab."
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
                      Name
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Account
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Designation
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Email
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Phone
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Flags
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-[220px] whitespace-nowrap py-2.5">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {paged.map((c) => {
                    const related = relatedFor(c.id);
                    return (
                      <TableRow
                        key={c.id}
                        className="border-b border-brand-200 last:border-b-0 cursor-pointer hover:bg-brand-50/40"
                        onClick={() =>
                          navigate(`/crm/accounts/${c.accountId}`, {
                            state: { from: "/crm/contacts", label: "Contacts" },
                          })
                        }
                      >
                        <TableCell className="py-1 text-base font-semibold text-slate-800">
                          {c.name}
                        </TableCell>
                        <TableCell className="py-1 text-base text-slate-600">
                          <div className="flex items-center justify-center gap-1">
                            {accountName(c.accountId)}
                          </div>
                        </TableCell>
                        <TableCell className="py-1 text-base text-slate-600">
                          {c.designation || "—"}
                          {c.department ? ` · ${c.department}` : ""}
                        </TableCell>
                        <TableCell
                          className="py-1 text-base text-slate-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              className="flex items-center gap-1 text-brand-600 hover:underline"
                            >
                              <Mail className="h-3 w-3" /> {c.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell
                          className="py-1 text-base text-slate-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.phone ? (
                            <a
                              href={`tel:${c.phone}`}
                              className="flex items-center gap-1 text-brand-600 hover:underline"
                            >
                              <Phone className="h-3 w-3" /> {c.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="py-1 space-x-1">
                          {c.isPrimary && (
                            <Badge variant="outline" className="text-xs">
                              Primary
                            </Badge>
                          )}
                          {c.isDecisionMaker && (
                            <Badge variant="outline" className="text-xs">
                              Decision Maker
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className="py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                              title="View account"
                              onClick={() =>
                                navigate(`/crm/accounts/${c.accountId}`, {
                                  state: {
                                    from: "/crm/contacts",
                                    label: "Contacts",
                                  },
                                })
                              }
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                              title="Edit contact"
                              onClick={() => openEdit(c)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            {isCrmAdmin(user) && (
                              <DeleteConfirmDialog
                                trigger={
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 gap-1 text-xs font-semibold text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </Button>
                                }
                                title={`Delete "${c.name}"?`}
                                description="This contact will be moved to the CRM Recycle Bin."
                                warning={
                                  related.opportunities + related.quotations > 0
                                    ? `This contact is linked to ${related.opportunities} deal(s) and ${related.quotations} quote(s) — those records will keep their contact reference removed, not be deleted.`
                                    : undefined
                                }
                                onConfirm={() =>
                                  deleteCrmContact(c.id, c.name, user)
                                }
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
