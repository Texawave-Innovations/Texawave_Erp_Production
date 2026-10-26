import { WarehouseStockView } from "@/features/scm/warehouse-ops/components/WarehouseStockView";

// The warehouse dashboard's "Occupied Bins" tile links here; same view as /scm/warehouse/stock.
export default function ScmWarehouseLocationStockPage() {
  return <WarehouseStockView />;
}
