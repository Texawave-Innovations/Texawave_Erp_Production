"use client";

import type { SalesMasterListCategory } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { MasterListCard, useToast } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateMasterListItem,
  useDeleteMasterListItem,
  useMasterListItems,
} from "../hooks";
import { MASTER_LIST_ITEM_READ, MASTER_LIST_ITEM_WRITE } from "../permissions";
import { masterListItemSchema } from "../schema";

const PAGE_SIZE = 50;

interface CategoryCardProps {
  category: SalesMasterListCategory;
  title: string;
  /** `true` only for `gst_rate` — shows an extra numeric percentage input. */
  showNumericValue?: boolean;
}

/** One category's add/delete chip card, wiring the shared `MasterListCard`
 * to this feature's sales-settings-master-list-items endpoint (Docs/
 * SALES_SETTINGS_FOUNDATION.md design decision #2: values are NOT unique per
 * category, an unstructured value list). */
function CategoryCard({
  category,
  title,
  showNumericValue = false,
}: CategoryCardProps) {
  const canRead = usePermission(MASTER_LIST_ITEM_READ);
  const canWrite = usePermission(MASTER_LIST_ITEM_WRITE);
  const { toast } = useToast();

  const query = useMasterListItems({ category, page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateMasterListItem();
  const deleteMutation = useDeleteMasterListItem();

  const items = (query.data?.data ?? []).map((item) => ({
    id: item.id,
    label:
      showNumericValue && item.numericValue !== null
        ? `${item.value} (${item.numericValue}%)`
        : item.value,
  }));

  async function handleAdd(value: string, numericValue?: number) {
    const parsed = masterListItemSchema.safeParse({
      value,
      ...(numericValue !== undefined ? { numericValue } : {}),
    });
    if (!parsed.success) {
      toast({
        title: parsed.error.issues[0]?.message ?? "Invalid input",
        variant: "error",
      });
      return;
    }
    try {
      await createMutation.mutateAsync({
        category,
        value: parsed.data.value,
        ...(parsed.data.numericValue !== undefined
          ? { numericValue: parsed.data.numericValue }
          : {}),
      });
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

  async function handleDelete(id: number | string, label: string) {
    try {
      await deleteMutation.mutateAsync(Number(id));
    } catch {
      toast({ title: `Could not delete "${label}"`, variant: "error" });
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
      showNumericValue={showNumericValue}
    />
  );
}

/** "Terms & Inventory" top-level tab — 8 identical add/delete chip cards. */
export function TermsInventoryTab() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <CategoryCard category="payment_term" title="Payment Terms" />
      <CategoryCard category="delivery_term" title="Delivery Terms" />
      <CategoryCard category="dispatch_mode" title="Dispatch Modes" />
      <CategoryCard category="gst_rate" title="GST Rates" showNumericValue />
      <CategoryCard category="item_category" title="Item Categories" />
      <CategoryCard category="item_type" title="Item Types" />
      <CategoryCard category="item_group" title="Item Groups" />
      <CategoryCard category="unit" title="Units" />
    </div>
  );
}
