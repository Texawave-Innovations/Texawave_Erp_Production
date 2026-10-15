"use client";

import {
  Button,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  useCreateCrmDocument,
  useCrmDocuments,
  useDeleteCrmDocument,
} from "../../../documents/hooks";

function AddDocumentForm({
  accountId,
  onDone,
}: {
  accountId: number;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createMutation = useCreateCrmDocument();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !link.trim()) {
      setError("Name and link are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        name,
        link,
        notes: notes || undefined,
      });
      toast({ title: "Document added", variant: "success" });
      onDone();
    } catch {
      setError("Could not add the document. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Name" required error={error ?? undefined}>
        {(fp) => (
          <Input
            {...fp}
            invalid={fp.invalid}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField
        label="Link"
        required
        hint="External link — no file upload, matching legacy."
      >
        {(fp) => (
          <Input
            {...fp}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Notes">
        {(fp) => (
          <Textarea
            {...fp}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onDone}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Add
        </Button>
      </div>
    </form>
  );
}

/** Documents tab: list + add name+link + delete. No real file upload and
 * no update endpoint — matches legacy `CrmDocument` exactly. */
export function DocumentsTab({ accountId }: { accountId: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const query = useCrmDocuments({
    relatedType: "account",
    relatedId: accountId,
    limit: 50,
  });
  const deleteMutation = useDeleteCrmDocument();
  const { toast } = useToast();

  async function handleDelete(id: number, name: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: `Deleted "${name}"`, variant: "success" });
    } catch {
      toast({ title: `Could not delete "${name}"`, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Documents
        </h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Add Document
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Add the first document link."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-3">
              <a
                href={d.link}
                target="_blank"
                rel="noreferrer"
                className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {d.name}
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDelete(d.id, d.name)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add document"
      >
        <AddDocumentForm
          accountId={accountId}
          onDone={() => setCreateOpen(false)}
        />
      </Dialog>
    </div>
  );
}
