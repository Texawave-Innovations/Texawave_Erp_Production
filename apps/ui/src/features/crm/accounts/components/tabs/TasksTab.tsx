"use client";

import type { CrmTaskPriority } from "@texawave-erp/api-types";
import { CRM_TASK_PRIORITIES } from "@texawave-erp/api-types";
import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  useCreateCrmTask,
  useCrmTasks,
  useUpdateCrmTaskStatus,
} from "../../../tasks/hooks";

function CreateTaskForm({
  accountId,
  onDone,
}: {
  accountId: number;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState<CrmTaskPriority>("Medium");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createMutation = useCreateCrmTask();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate || !assignedTo.trim()) {
      setError("Title, due date, and assignee are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        title,
        dueDate,
        assignedTo,
        priority,
        notes: notes || undefined,
      });
      toast({ title: "Task created", variant: "success" });
      onDone();
    } catch {
      setError("Could not create the task. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Title" required error={error ?? undefined}>
        {(fp) => (
          <Input
            {...fp}
            invalid={fp.invalid}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Due date" required>
        {(fp) => (
          <Input
            {...fp}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Assigned to" required>
        {(fp) => (
          <Input
            {...fp}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <FormField label="Priority">
        {(fp) => (
          <Select
            {...fp}
            value={priority}
            onChange={(e) => setPriority(e.target.value as CrmTaskPriority)}
          >
            {CRM_TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
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
          Create
        </Button>
      </div>
    </form>
  );
}

/** Tasks tab: list + create + mark-complete, using the new tasks api/hooks.
 * `CrmTask` only has Open/Completed (unlike HR's Task). */
export function TasksTab({ accountId }: { accountId: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const query = useCrmTasks({
    relatedType: "account",
    relatedId: accountId,
    limit: 50,
  });
  const updateStatus = useUpdateCrmTaskStatus();
  const { toast } = useToast();

  async function toggleComplete(id: number, completed: boolean) {
    await updateStatus.mutateAsync({
      id,
      input: { status: completed ? "Completed" : "Open" },
    });
    toast({
      title: completed ? "Task completed" : "Task reopened",
      variant: "success",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Tasks
        </h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Add Task
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError || !query.data || query.data.data.length === 0 ? (
        <EmptyState title="No tasks yet" description="Add the first task." />
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={t.status === "Completed"}
                  onChange={(e) => void toggleComplete(t.id, e.target.checked)}
                />
                <div>
                  <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
                    {t.title}
                  </p>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Due {t.dueDate} · {t.assignedTo}
                  </p>
                </div>
              </div>
              <StatusBadge
                label={t.status}
                colorToken={t.status === "Completed" ? "success" : "brand"}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add task"
      >
        <CreateTaskForm
          accountId={accountId}
          onDone={() => setCreateOpen(false)}
        />
      </Dialog>
    </div>
  );
}
