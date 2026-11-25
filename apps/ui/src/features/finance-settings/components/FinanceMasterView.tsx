"use client";

import type { FinanceMasterListCategory } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { MasterListCard } from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateMasterListItem,
  useDeleteMasterListItem,
  useMasterListItems,
} from "../hooks";
import { MASTER_LIST_ITEM_READ, MASTER_LIST_ITEM_WRITE } from "../permissions";
import { financeMasterListItemSchema } from "../schema";

const PAGE_SIZE = 50;

interface CategoryCardProps {
  category: FinanceMasterListCategory;
  title: string;
}

/** One category's add/delete chip card, wiring the shared `MasterListCard`
 * to this feature's finance-settings-master-list-items endpoint.
 * Values are not unique per category: an unstructured value list. */
function CategoryCard({ category, title }: CategoryCardProps) {
  const canRead = usePermission(MASTER_LIST_ITEM_READ);
  const canWrite = usePermission(MASTER_LIST_ITEM_WRITE);
  const { notify } = useNotify();

  const query = useMasterListItems({ category, page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateMasterListItem();
  const deleteMutation = useDeleteMasterListItem();

  const items = (query.data?.data ?? []).map((item) => ({
    id: item.id,
    label: item.value,
  }));

  async function handleAdd(value: string) {
    const parsed = financeMasterListItemSchema.safeParse({ value });
    if (!parsed.success) {
      notify("finance.master.invalid", {
        reason: parsed.error.issues[0]?.message ?? "Invalid input",
      });
      return;
    }
    try {
      await createMutation.mutateAsync({
        category,
        value: parsed.data.value,
      });
    } catch (error) {
      if (error instanceof ApiError && error.isPermissionError) {
        notify("finance.master.permissionDenied", {
          permission: MASTER_LIST_ITEM_WRITE,
        });
      } else {
        notify("finance.master.addFailed");
      }
    }
  }

  async function handleDelete(id: number | string, label: string) {
    try {
      await deleteMutation.mutateAsync(Number(id));
    } catch {
      notify("finance.master.deleteFailed", { label });
    }
  }

  return (
    <MasterListCard
      title={title}
      items={items}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      canRead={canRead}
      canWrite={canWrite}
      readPermissionCode={MASTER_LIST_ITEM_READ}
      writePermissionCode={MASTER_LIST_ITEM_WRITE}
      isSubmitting={createMutation.isPending}
      onAdd={handleAdd}
      onDelete={handleDelete}
    />
  );
}

/** Finance Master page — Expense Types and Payment Modes cards. A future
 * Finance module (expenses, payments) reads these via
 * `finance-settings/master-list-items?category=expense_type|payment_mode`
 * and references a row by `id` (Docs/FINANCE_MASTER_LIST.md). */
export function FinanceMasterView() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <CategoryCard category="expense_type" title="Expense Types" />
      <CategoryCard category="payment_mode" title="Payment Modes" />
    </div>
  );
}
