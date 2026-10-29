"use client";

import type { ScmMasterListCategory } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { MasterListCard, useToast } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateMasterListItem,
  useDeleteMasterListItem,
  useMasterListItems,
} from "../hooks";
import { MASTER_LIST_ITEM_READ, MASTER_LIST_ITEM_WRITE } from "../permissions";
import { scmMasterListItemSchema } from "../schema";

const PAGE_SIZE = 50;

interface CategoryCardProps {
  category: ScmMasterListCategory;
  title: string;
}

/** One category's add/delete chip card, wiring the shared `MasterListCard`
 * to this feature's scm-master-list-items endpoint. Mirrors
 * apps/ui/src/features/finance-settings/components/FinanceMasterView.tsx's
 * `CategoryCard` — values are not unique per category, an unstructured
 * value list. */
function CategoryCard({ category, title }: CategoryCardProps) {
  const canRead = usePermission(MASTER_LIST_ITEM_READ);
  const canWrite = usePermission(MASTER_LIST_ITEM_WRITE);
  const { toast } = useToast();

  const query = useMasterListItems({ category, page: 1, limit: PAGE_SIZE });
  const createMutation = useCreateMasterListItem();
  const deleteMutation = useDeleteMasterListItem();

  const items = (query.data?.data ?? []).map((item) => ({
    id: item.id,
    label: item.value,
  }));

  async function handleAdd(value: string) {
    const parsed = scmMasterListItemSchema.safeParse({ value });
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
    />
  );
}

/** SCM Master page — one card per category. Each SCM consumer form (Supplier,
 * ScmPackingPackage, ScmWarehouse, ScmStockAdjustment, Carrier, Shipment,
 * returns, quality defects, requisitions, supplier documents) reads these via
 * `scm/master-list-items?category=...` and references a row by `id`. */
export function ScmMasterView() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <CategoryCard category="supplier_type" title="Supplier Types" />
      <CategoryCard category="package_type" title="Package Types" />
      <CategoryCard category="warehouse_type" title="Warehouse Types" />
      <CategoryCard
        category="stock_adjustment_reason"
        title="Stock Adjustment Reasons"
      />
      <CategoryCard
        category="shipment_service_type"
        title="Shipment Service Types"
      />
      <CategoryCard
        category="shipment_exception_reason"
        title="Shipment Exception Reasons"
      />
      <CategoryCard category="return_reason" title="Return Reasons" />
      <CategoryCard
        category="quality_defect_category"
        title="Quality Defect Categories"
      />
      <CategoryCard
        category="requisition_priority"
        title="Requisition Priorities"
      />
      <CategoryCard
        category="supplier_document_type"
        title="Supplier Document Types"
      />
      <CategoryCard
        category="quality_defect_severity"
        title="Quality Defect Severities"
      />
      <CategoryCard
        category="quality_inspection_priority"
        title="Quality Inspection Priorities"
      />
    </div>
  );
}
