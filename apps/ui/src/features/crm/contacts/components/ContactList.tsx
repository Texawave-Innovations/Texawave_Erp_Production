"use client";

import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Input } from "@/components/legacy-ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { ImportExportBar } from "@/features/crm/bulk-import/components/ImportExportBar";
import { celebrateCrm } from "@/features/crm/celebration";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { usePermission } from "@/hooks/usePermission";
import type { Contact } from "@texawave-erp/api-types";
import { ApiError, type CreateContactFormValues } from "@texawave-erp/core";
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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AccountPicker } from "../../accounts/components/AccountPicker";
import {
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from "../hooks";
import { ContactForm } from "./ContactForm";

const WRITE_PERMS = [
  "crm.contact.write.own",
  "crm.contact.write.team",
  "crm.contact.write.all",
] as const;

/** Legacy Contacts.tsx: list card with account filter + search + import/
 * export + Add Contact, gradient table with flags and View/Edit/Delete row
 * actions, and the full-page create/edit form. */
export function ContactList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | undefined>();
  const [mode, setMode] = useState<"list" | "create">("list");
  const [editing, setEditing] = useState<Contact | null>(null);

  const canWrite = usePermission(WRITE_PERMS);

  const query = useContacts({
    page,
    limit: pageSize,
    q: search.trim() || undefined,
    accountId: accountFilter,
  });
  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();

  async function handleCreate(values: CreateContactFormValues) {
    await createMutation.mutateAsync(values);
    toast.success("Contact created");
    celebrateCrm("contact.created");
    setMode("list");
  }

  async function handleUpdate(values: CreateContactFormValues) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input: values });
    toast.success("Contact updated");
    setEditing(null);
  }

  async function handleDelete(contact: Contact) {
    try {
      await deleteMutation.mutateAsync(contact.id);
      toast.success(`Deleted "${contact.name}"`);
    } catch (err) {
      throw new Error(
        err instanceof ApiError
          ? err.message
          : `Could not delete "${contact.name}"`,
      );
    }
  }

  const openAccount = (c: Contact) =>
    router.push(`/crm/accounts/${c.accountId}`);

  const backButton = (onClick: () => void) => (
    <div className="flex items-center gap-2">
      <BackToDashboardButton />
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={onClick}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Contacts
      </Button>
    </div>
  );

  if (mode === "create") {
    return (
      <div className="space-y-6 pb-8">
        {backButton(() => setMode("list"))}
        <ContactForm
          title="Add Contact"
          submitLabel="Create Contact"
          initialValues={
            accountFilter ? { accountId: accountFilter } : undefined
          }
          onSubmit={handleCreate}
          onCancel={() => setMode("list")}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-6 pb-8">
        {backButton(() => setEditing(null))}
        <ContactForm
          key={editing.id}
          title="Edit Contact"
          submitLabel="Save Changes"
          initialValues={{
            accountId: editing.accountId,
            name: editing.name,
            designation: editing.designation ?? undefined,
            department: editing.department ?? undefined,
            email: editing.email ?? undefined,
            phone: editing.phone ?? undefined,
            whatsapp: editing.whatsapp ?? undefined,
            isPrimary: editing.isPrimary,
            isDecisionMaker: editing.isDecisionMaker,
          }}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  const rows = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, query.data?.meta.totalPages ?? 1);
  const noAccess =
    query.isError &&
    query.error instanceof ApiError &&
    query.error.isPermissionError;

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
            <div className="w-44">
              <AccountPicker
                value={accountFilter}
                allLabel="All Accounts"
                onChange={(id) => {
                  setAccountFilter(id);
                  setPage(1);
                }}
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search contacts…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <ImportExportBar
              entity="contacts"
              moduleLabel="Contacts"
              fileBaseName="crm-contacts"
              search={search}
            />
            {canWrite && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5 shrink-0"
                onClick={() => setMode("create")}
              >
                <Plus className="h-4 w-4" /> Add Contact
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Contacts…
            </div>
          ) : noAccess ? (
            <EmptyState
              icon={Users}
              title="You don't have access to CRM contacts"
              description="Ask an administrator for the crm.contact.read permission."
            />
          ) : query.isError ? (
            <div className="text-center py-16 text-sm text-slate-500">
              Could not load contacts.{" "}
              <button
                type="button"
                className="text-brand-600 underline"
                onClick={() => void query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                search ? `No contacts match "${search}"` : "No contacts yet"
              }
              description="Add a contact here, or from inside an Account's Contacts tab."
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
                    {[
                      "Name",
                      "Account",
                      "Designation",
                      "Email",
                      "Phone",
                      "Flags",
                    ].map((h) => (
                      <TableHead
                        key={h}
                        className="font-black text-sm uppercase tracking-wider text-white py-2.5"
                      >
                        {h}
                      </TableHead>
                    ))}
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-[220px] whitespace-nowrap py-2.5">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {rows.map((c) => (
                    <TableRow
                      key={c.id}
                      className="border-b border-brand-200 last:border-b-0 cursor-pointer hover:bg-brand-50/40"
                      onClick={() => openAccount(c)}
                    >
                      <TableCell className="py-1 text-base font-semibold text-slate-800">
                        {c.name}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        <div className="flex items-center justify-center gap-1">
                          {c.account.name}
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
                            onClick={() => openAccount(c)}
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          {canWrite && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg"
                                title="Edit contact"
                                onClick={() => setEditing(c)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
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
                                  (c.linkedOpportunityCount ?? 0) +
                                    (c.linkedQuotationCount ?? 0) >
                                  0
                                    ? `This contact is linked to ${c.linkedOpportunityCount ?? 0} deal(s) and ${c.linkedQuotationCount ?? 0} quote(s) — those records will keep their contact reference removed, not be deleted.`
                                    : undefined
                                }
                                onConfirm={() => handleDelete(c)}
                              />
                            </>
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
            page={Math.min(page, totalPages)}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            totalPages={totalPages}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
