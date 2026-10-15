"use client";

import {
  Button,
  EmptyState,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  useCreateCrmNote,
  useCrmNotes,
  useDeleteCrmNote,
} from "../../../notes/hooks";

/** Notes tab: list + add + delete. `CrmNote` is account-scoped only (not
 * polymorphic relatedType/relatedId) and has no update endpoint, matching
 * legacy exactly. Architecturally distinct from the Activities tab's
 * `type: 'Note'` entries — two unrelated "Notes" concepts in legacy. */
export function NotesTab({ accountId }: { accountId: number }) {
  const [content, setContent] = useState("");
  const query = useCrmNotes({ accountId, limit: 50 });
  const createMutation = useCreateCrmNote();
  const deleteMutation = useDeleteCrmNote();
  const { toast } = useToast();

  async function handleAdd() {
    if (!content.trim()) return;
    await createMutation.mutateAsync({ accountId, content });
    setContent("");
    toast({ title: "Note added", variant: "success" });
  }

  async function handleDelete(id: number) {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Note deleted", variant: "success" });
    } catch {
      toast({ title: "Could not delete note", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
        Notes
      </h3>

      <div className="flex flex-col gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="Add a note…"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => void handleAdd()}
            disabled={!content.trim()}
          >
            Add Note
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState title="No notes yet" description="Add the first note." />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div>
                <p className="text-theme-sm text-gray-900 dark:text-white/90">
                  {n.content}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDelete(n.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
