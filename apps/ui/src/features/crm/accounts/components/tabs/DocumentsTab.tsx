"use client";

import type { CrmDocument } from "@texawave-erp/api-types";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import { Textarea } from "@/components/legacy-ui/textarea";
import {
  useCreateCrmDocument,
  useDeleteCrmDocument,
} from "@/features/crm/documents/hooks";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { usePermission } from "@/hooks/usePermission";
import {
  CRM_DELETE_BTN_CLASS,
  FormRow,
  InlineFormPanel,
  SectionShell,
} from "../accountUi";

function DocumentInlineForm({
  accountId,
  onCancel,
  onSaved,
}: {
  accountId: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const createMutation = useCreateCrmDocument();
  const [form, setForm] = useState({ name: "", link: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.link.trim()) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        name: form.name.trim(),
        link: form.link.trim(),
        notes: form.notes.trim() || undefined,
      });
      onSaved();
    } catch {
      toast.error("Failed to add document. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={FileText}
      title="Add Document"
      subtitle="Add a shared-drive or file link — direct file upload isn't wired up yet."
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Add Document"
      saving={saving}
      canSubmit={Boolean(form.name.trim() && form.link.trim())}
    >
      <div className="space-y-4">
        <FormRow label="Name" required>
          <Input
            className="h-9 rounded-xl"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Signed NDA"
          />
        </FormRow>
        <FormRow label="Link" required>
          <Input
            className="h-9 rounded-xl"
            value={form.link}
            onChange={(e) => set("link", e.target.value)}
            placeholder="Shared drive / storage link"
          />
        </FormRow>
        <FormRow label="Notes">
          <Textarea
            rows={2}
            className="rounded-xl"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </FormRow>
      </div>
    </InlineFormPanel>
  );
}

export function DocumentsTab({
  accountId,
  documents,
}: {
  accountId: number;
  documents: CrmDocument[];
}) {
  const [adding, setAdding] = useState(false);
  const canDelete = usePermission("crm.document.delete");
  const deleteMutation = useDeleteCrmDocument();

  if (adding) {
    return (
      <DocumentInlineForm
        accountId={accountId}
        onCancel={() => setAdding(false)}
        onSaved={() => setAdding(false)}
      />
    );
  }

  return (
    <SectionShell
      title="Documents"
      action={
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add Document
        </Button>
      }
    >
      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Add a shared-drive or file link — direct file upload isn't wired up yet."
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {documents.map((d) => (
            <div
              key={d.id}
              className="p-4 flex items-center justify-between gap-3 hover:bg-brand-50/40"
            >
              <a
                href={d.link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {d.name}
                  </p>
                  <p className="text-sm text-slate-900 mt-0.5">
                    {d.uploadedByName ? `${d.uploadedByName} · ` : ""}
                    {new Date(d.uploadedAt).toLocaleString()}
                  </p>
                </div>
              </a>
              {canDelete && (
                <DeleteConfirmDialog
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className={CRM_DELETE_BTN_CLASS}
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  }
                  title="Delete this document?"
                  description={`"${d.name}" will be moved to the CRM Recycle Bin (the link itself is unaffected).`}
                  onConfirm={async () => {
                    await deleteMutation.mutateAsync(d.id);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
