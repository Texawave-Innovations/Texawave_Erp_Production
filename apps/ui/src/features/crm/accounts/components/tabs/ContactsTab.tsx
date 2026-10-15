"use client";

import type { Contact } from "@texawave-erp/api-types";
import type { CreateContactFormValues } from "@texawave-erp/core";
import {
  Button,
  Dialog,
  EmptyState,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { ContactForm } from "../../../contacts/components/ContactForm";
import { useContacts, useCreateContact } from "../../../contacts/hooks";

/** Contacts tab — reuses the existing Contacts hooks/form (does not
 * rebuild the Contacts module), scoped to this account via `accountId`. */
export function ContactsTab({ accountId }: { accountId: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const query = useContacts({ accountId, limit: 50 });
  const createMutation = useCreateContact();

  async function handleCreate(values: CreateContactFormValues) {
    await createMutation.mutateAsync({ ...values, accountId });
    setCreateOpen(false);
    toast({ title: "Contact created", variant: "success" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Contacts
        </h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Add Contact
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add the first contact for this account."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((c: Contact) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
                  {c.name}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {[c.designation, c.department].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </div>
              <div className="text-theme-xs text-gray-500 dark:text-gray-400">
                {c.email ?? c.phone ?? "—"}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New contact"
      >
        <ContactForm
          initialValues={{ accountId }}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create contact"
        />
      </Dialog>
    </div>
  );
}
