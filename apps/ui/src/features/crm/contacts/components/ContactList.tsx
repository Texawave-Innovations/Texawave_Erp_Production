"use client";

import type { Contact } from "@texawave-erp/api-types";
import { ApiError, type CreateContactFormValues } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { AccountCombobox } from "../../accounts/components/AccountCombobox";
import { useAccounts } from "../../accounts/hooks";
import {
  useCreateContact,
  useContacts,
  useDeleteContact,
  useUpdateContact,
} from "../hooks";
import { ContactForm } from "./ContactForm";

const PAGE_SIZE = 20;

/** Reproduces legacy Contacts.tsx: search across name/designation/email/
 * phone + resolved account name, an account filter dropdown, the exact
 * table columns (Name, Account, Designation+Department, Email, Phone,
 * Flags, Action), and "Add Contact" disabled when zero accounts exist. */
export function ContactList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const { toast } = useToast();

  const accountsQuery = useAccounts({ limit: 1 });
  const hasAccounts = (accountsQuery.data?.meta.total ?? 0) > 0;

  const query = useContacts({
    page,
    limit: PAGE_SIZE,
    q: search || undefined,
    accountId: accountFilter,
  });
  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();

  async function handleCreate(values: CreateContactFormValues) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({ title: "Contact created", variant: "success" });
  }

  async function handleUpdate(values: CreateContactFormValues) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input: values });
    setEditing(null);
    toast({ title: "Contact updated", variant: "success" });
  }

  async function handleDelete(contact: Contact) {
    try {
      await deleteMutation.mutateAsync(contact.id);
      toast({ title: `Deleted "${contact.name}"`, variant: "success" });
    } catch {
      toast({ title: `Could not delete "${contact.name}"`, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Contacts
        </h1>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={!hasAccounts}
          title={
            hasAccounts
              ? undefined
              : "Create an account before adding a contact"
          }
        >
          Add Contact
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search name, designation, email, phone, account..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <div className="w-64">
          <AccountCombobox
            value={accountFilter}
            onChange={(id) => {
              setAccountFilter(id);
              setPage(1);
            }}
            includeAllOption
          />
        </div>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to CRM contacts"
          >
            Ask an administrator for the <code>crm.contact.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No contacts yet"
            description={
              hasAccounts
                ? "Create your first contact to see it here."
                : "Create an account first, then add a contact."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable<Contact>
            columns={[
              { header: "Name", cell: (c) => c.name },
              { header: "Account", cell: (c) => c.account.name },
              {
                header: "Designation",
                cell: (c) => (
                  <span>
                    {c.designation ?? "—"}
                    {c.department ? ` · ${c.department}` : ""}
                  </span>
                ),
              },
              {
                header: "Email",
                cell: (c) =>
                  c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—",
              },
              {
                header: "Phone",
                cell: (c) =>
                  c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "—",
              },
              {
                header: "Flags",
                cell: (c) => (
                  <div className="flex gap-1">
                    {c.isPrimary ? (
                      <StatusBadge label="Primary" colorToken="success" />
                    ) : null}
                    {c.isDecisionMaker ? (
                      <StatusBadge label="Decision-Maker" colorToken="brand" />
                    ) : null}
                  </div>
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (c) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(c)}
                      aria-label={`Edit ${c.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(c)}
                      aria-label={`Delete ${c.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={query.data.data}
            getRowKey={(c) => String(c.id)}
          />
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New contact"
      >
        <ContactForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create contact"
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit contact"
      >
        {editing ? (
          <ContactForm
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
            submitLabel="Save changes"
          />
        ) : null}
      </Dialog>
    </div>
  );
}
