"use client";

import type { CrmNote } from "@texawave-erp/api-types";
import { Send, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import { Textarea } from "@/components/legacy-ui/textarea";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { useCreateCrmNote, useDeleteCrmNote } from "@/features/crm/notes/hooks";
import { usePermission } from "@/hooks/usePermission";
import { CRM_DELETE_BTN_CLASS, SectionShell } from "../accountUi";

export function NotesTab({
  accountId,
  accountName,
  notes,
}: {
  accountId: number;
  accountName: string;
  notes: CrmNote[];
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const canDelete = usePermission("crm.note.delete");
  const createMutation = useCreateCrmNote();
  const deleteMutation = useDeleteCrmNote();

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({ accountId, content: draft.trim() });
      setDraft("");
    } catch {
      toast.error("Failed to add note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell title="Notes">
      <div className="p-4 space-y-2.5 border-b border-slate-100">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add a note about ${accountName || "this account"}…`}
          className="rounded-xl text-sm"
          rows={2}
        />
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          disabled={!draft.trim() || saving}
          onClick={() => void handleAdd()}
        >
          <Send className="h-3.5 w-3.5" /> Add Note
        </Button>
      </div>
      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" />
      ) : (
        <div className="divide-y divide-slate-100">
          {notes.map((n) => (
            <div
              key={n.id}
              className="p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-700">{n.content}</p>
                <p className="text-sm text-slate-900 mt-1">
                  {n.createdByName ? `${n.createdByName} · ` : ""}
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {canDelete && (
                <DeleteConfirmDialog
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className={CRM_DELETE_BTN_CLASS}
                      title="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  }
                  title="Delete this note?"
                  description="This note will be moved to the CRM Recycle Bin."
                  onConfirm={async () => {
                    await deleteMutation.mutateAsync(n.id);
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
