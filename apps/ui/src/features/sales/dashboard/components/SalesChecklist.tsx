"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { type MessageKey, resolveErrorText } from "@texawave-erp/core";
import {
  Button,
  DatePicker,
  ErrorState,
  FormField,
  Input,
  SectionCard,
  Skeleton,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { formatDate, todayIst } from "../../shared/format";
import {
  useCreateActionItem,
  useDeleteActionItem,
  useOpenActionItems,
  useSetActionItemDone,
} from "../hooks";

/** The dashboard's follow-up checklist (open items). */
export function SalesChecklist() {
  const canRead = usePermission(SALES_PERMISSIONS.actionItemRead);
  const canWrite = usePermission(SALES_PERMISSIONS.actionItemWrite);
  const { notify } = useNotify();
  const query = useOpenActionItems(canRead);
  const create = useCreateActionItem();
  const setDone = useSetActionItemDone();
  const remove = useDeleteActionItem();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!canRead) return null;
  const today = todayIst();

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) {
      setError("Enter a follow-up");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        title: value,
        ...(dueDate ? { dueDate } : {}),
      });
      setTitle("");
      setDueDate("");
    } catch (e) {
      setError(resolveErrorText(e, "sales.checklist.addFailed"));
    }
  }

  async function act(fn: () => Promise<unknown>, failed: MessageKey) {
    try {
      await fn();
    } catch {
      notify(failed);
    }
  }

  return (
    <SectionCard
      id="sales-checklist"
      title="Follow-up checklist"
      // The date popover opens below the field; the card must not clip it.
      className="overflow-visible"
    >
      {canWrite ? (
        <form onSubmit={handleAdd} className="flex flex-col gap-3" noValidate>
          <FormField label="New follow-up" error={error ?? undefined}>
            {(f) => (
              <Input
                {...f}
                placeholder="Call Global Enterprises about PO"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </FormField>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <FormField label="Due date">
              {(f) => (
                <DatePicker
                  {...f}
                  placement="bottom"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              )}
            </FormField>
            <Button type="submit" loading={create.isPending}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          </div>
        </form>
      ) : null}

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Nothing to follow up. You&apos;re all caught up.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {query.data.data.map((item) => {
            const overdue = item.dueDate !== null && item.dueDate < today;
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-theme-sm text-gray-900 dark:text-white/90">
                    {item.title}
                  </span>
                  {item.dueDate ? (
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      Due {formatDate(item.dueDate)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  {overdue ? (
                    <StatusBadge label="Overdue" colorToken="error" />
                  ) : null}
                  {canWrite ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Mark "${item.title}" done`}
                        onClick={() =>
                          void act(
                            () =>
                              setDone.mutateAsync({ id: item.id, done: true }),
                            "sales.checklist.completeFailed",
                          )
                        }
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete "${item.title}"`}
                        onClick={() =>
                          void act(
                            () => remove.mutateAsync(item.id),
                            "sales.checklist.deleteFailed",
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
