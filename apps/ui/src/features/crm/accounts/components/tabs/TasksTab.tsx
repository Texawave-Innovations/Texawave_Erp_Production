"use client";

import type { CrmTask, CrmTaskPriority } from "@texawave-erp/api-types";
import { CRM_TASK_PRIORITIES } from "@texawave-erp/api-types";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import { celebrateCrm } from "@/features/crm/celebration";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import {
  useCreateCrmTask,
  useDeleteCrmTask,
  useUpdateCrmTaskStatus,
} from "@/features/crm/tasks/hooks";
import { usePermission } from "@/hooks/usePermission";
import {
  COMPLETE_BTN_CLASS,
  CRM_DELETE_BTN_CLASS,
  FormRow,
  InlineFormPanel,
  SectionShell,
} from "../accountUi";

function TaskInlineForm({
  accountId,
  currentUser,
  onCancel,
  onSaved,
}: {
  accountId: number;
  currentUser: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const createMutation = useCreateCrmTask();
  const [form, setForm] = useState({
    title: "",
    dueDate: "",
    assignedTo: currentUser,
    priority: "Medium" as CrmTaskPriority,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.dueDate || !form.assignedTo.trim()) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        title: form.title.trim(),
        dueDate: form.dueDate,
        assignedTo: form.assignedTo.trim(),
        priority: form.priority,
        notes: form.notes.trim() || undefined,
      });
      onSaved();
    } catch {
      toast.error("Failed to add task. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={CheckCircle2}
      title="Add Task"
      subtitle="Add a to-do for this account."
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Add Task"
      saving={saving}
      canSubmit={Boolean(
        form.title.trim() && form.dueDate && form.assignedTo.trim(),
      )}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <FormRow label="Title" required className="md:col-span-2">
          <Input
            className="h-9 rounded-xl"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Send updated pricing sheet"
          />
        </FormRow>
        <FormRow label="Due Date" required>
          <DatePicker
            className="h-9"
            value={form.dueDate}
            onChange={(v) => set("dueDate", v)}
          />
        </FormRow>
        <FormRow label="Assigned To">
          <Input
            className="h-9 rounded-xl"
            value={form.assignedTo}
            onChange={(e) => set("assignedTo", e.target.value)}
          />
        </FormRow>
        <FormRow label="Priority">
          <Select
            value={form.priority}
            onValueChange={(v) => set("priority", v as CrmTaskPriority)}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRM_TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Notes" className="md:col-span-2">
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

export function TasksTab({
  accountId,
  currentUser,
  tasks,
}: {
  accountId: number;
  currentUser: string;
  tasks: CrmTask[];
}) {
  const [adding, setAdding] = useState(false);
  const canDelete = usePermission("crm.task.delete");
  const updateStatus = useUpdateCrmTaskStatus();
  const deleteMutation = useDeleteCrmTask();

  if (adding) {
    return (
      <TaskInlineForm
        accountId={accountId}
        currentUser={currentUser}
        onCancel={() => setAdding(false)}
        onSaved={() => setAdding(false)}
      />
    );
  }

  return (
    <SectionShell
      title="Tasks"
      action={
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      }
    >
      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No tasks yet"
          description="Add a to-do for this account."
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="p-4 flex items-start justify-between gap-3 flex-wrap"
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    t.status === "Completed"
                      ? "text-slate-400 line-through"
                      : "text-slate-800",
                  )}
                >
                  {t.title}
                </p>
                <p className="text-sm text-slate-900 mt-1">
                  Due {t.dueDate.slice(0, 10)} · {t.assignedTo} · {t.priority}{" "}
                  priority
                </p>
                {t.notes && (
                  <p className="text-sm text-slate-900 mt-0.5">{t.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {t.status !== "Completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={COMPLETE_BTN_CLASS}
                    onClick={() =>
                      updateStatus.mutate(
                        { id: t.id, input: { status: "Completed" } },
                        { onSuccess: () => celebrateCrm("task.completed") },
                      )
                    }
                  >
                    <CheckCircle2 className="h-3 w-3" /> Complete
                  </Button>
                )}
                {canDelete && (
                  <DeleteConfirmDialog
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className={CRM_DELETE_BTN_CLASS}
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    }
                    title="Delete this task?"
                    description="This task will be moved to the CRM Recycle Bin."
                    onConfirm={async () => {
                      await deleteMutation.mutateAsync(t.id);
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
