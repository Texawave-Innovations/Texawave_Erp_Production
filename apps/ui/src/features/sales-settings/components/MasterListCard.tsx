"use client";

import type { SalesMasterListCategory } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateMasterListItem,
  useDeleteMasterListItem,
  useMasterListItems,
} from "../hooks";
import { MASTER_LIST_ITEM_READ, MASTER_LIST_ITEM_WRITE } from "../permissions";
import { masterListItemSchema } from "../schema";

const PAGE_SIZE = 50;

export interface MasterListCardProps {
  category: SalesMasterListCategory;
  title: string;
  /** `true` only for `gst_rate` — shows an extra numeric percentage input. */
  showNumericValue?: boolean;
}

/** One "add/delete chip" card — backs one of the 8 Terms & Inventory
 * categories (Docs/SALES_SETTINGS_FOUNDATION.md design decision #2: values
 * are NOT unique per category, an unstructured value list). */
export function MasterListCard({
  category,
  title,
  showNumericValue = false,
}: MasterListCardProps) {
  const canRead = usePermission(MASTER_LIST_ITEM_READ);
  const canWrite = usePermission(MASTER_LIST_ITEM_WRITE);
  const { toast } = useToast();

  const query = useMasterListItems({ category, page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateMasterListItem();
  const deleteMutation = useDeleteMasterListItem();

  const [value, setValue] = useState("");
  const [numericValue, setNumericValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!canRead) {
    return (
      <Alert variant="warning" title={`You don't have access to ${title}`}>
        Ask an administrator for the <code>{MASTER_LIST_ITEM_READ}</code>{" "}
        permission.
      </Alert>
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = masterListItemSchema.safeParse({
      value,
      ...(showNumericValue && numericValue !== ""
        ? { numericValue: Number(numericValue) }
        : {}),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        category,
        value: parsed.data.value,
        ...(parsed.data.numericValue !== undefined
          ? { numericValue: parsed.data.numericValue }
          : {}),
      });
      setValue("");
      setNumericValue("");
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${MASTER_LIST_ITEM_WRITE} permission.`
            : "Could not add this item",
        variant: "error",
      });
    }
  }

  async function handleDelete(id: number, label: string) {
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      toast({ title: `Could not delete "${label}"`, variant: "error" });
    }
  }

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-2">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          {title}
        </h3>

        {query.isPending ? (
          <Skeleton className="h-6 w-full" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.data.data.length === 0 ? (
          <EmptyState
            title="No items yet"
            description={`Add a ${title.toLowerCase()} value below.`}
          />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {query.data.data.map((item) => (
              <li
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/80 px-2.5 py-1 text-theme-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-300"
              >
                <span>
                  {item.value}
                  {showNumericValue && item.numericValue !== null
                    ? ` (${item.numericValue}%)`
                    : ""}
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    aria-label={`Remove ${item.value}`}
                    onClick={() => void handleDelete(item.id, item.value)}
                    className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canWrite ? (
          <form onSubmit={handleAdd} className="flex items-end gap-2">
            <Input
              aria-label={`New ${title} value`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Add value"
              disabled={createMutation.isPending}
              className="flex-1"
            />
            {showNumericValue ? (
              <Input
                aria-label="Percentage"
                type="number"
                step="0.01"
                value={numericValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Digits and a single decimal point only, mirroring the
                  // onboarding wizard's live-sanitization pattern.
                  const sanitized = raw.replace(/[^\d.]/g, "");
                  setNumericValue(sanitized);
                }}
                placeholder="%"
                disabled={createMutation.isPending}
                className="w-20"
              />
            ) : null}
            <Button type="submit" size="sm" loading={createMutation.isPending}>
              Add
            </Button>
          </form>
        ) : null}
        {formError ? (
          <p className="text-theme-xs text-error-600 dark:text-error-400">
            {formError}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
