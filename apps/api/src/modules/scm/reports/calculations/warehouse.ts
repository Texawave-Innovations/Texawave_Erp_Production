import type {
  StockBalance,
  Warehouse,
  WarehouseLocation,
  WarehouseMovement,
  WarehousePacking,
  WarehousePicking,
  WarehousePutaway,
} from "@/types";
import {
  type DateRange,
  bucketSeriesByPeriod,
  groupBy,
  inRange,
  pickGranularity,
} from "../reportHelpers";
import {
  type ReportFilters,
  type Series,
  computeOccupancyByLocation,
  matchWarehouse,
  warehouseName,
  withKeyLabels,
} from "./shared";

export interface WarehouseInput {
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  putaways: WarehousePutaway[];
  movements: WarehouseMovement[];
  pickings: WarehousePicking[];
  packings: WarehousePacking[];
  stockBalances: StockBalance[];
}

export interface WarehouseKpis {
  warehouseCount: number;
  activeWarehouseCount: number;
  locationCount: number;
  putawayCount: number;
  movementCount: number;
  pickingCount: number;
  packingCount: number;
}

type OperationKind = "Putaway" | "Movement" | "Picking" | "Packing";
type OperationSeries = Record<OperationKind, number>;

export interface LocationUtilizationRow {
  key: string;
  label: string;
  occupied: number;
  capacity: number;
  percent: number;
}

export interface WarehouseReportData {
  kpis: WarehouseKpis;
  operationsVolume: Array<{ period: string; label: string } & OperationSeries>;
  stockByWarehouse: Series[];
  locationUtilization: {
    rated: LocationUtilizationRow[];
    unratedCount: number;
  } | null;
}

function selectWarehouse(
  input: WarehouseInput,
  range: DateRange,
  filters: ReportFilters,
) {
  const scoped = <T extends { createdAt: number; warehouseId: string }>(
    list: T[],
  ) =>
    list.filter(
      (x) =>
        inRange(x.createdAt, range) && matchWarehouse(x.warehouseId, filters),
    );
  return {
    locations: input.locations.filter((l) =>
      matchWarehouse(l.warehouseId, filters),
    ),
    putaways: scoped(input.putaways),
    movements: scoped(input.movements),
    pickings: scoped(input.pickings),
    packings: scoped(input.packings),
  };
}

function warehouseKpis(
  input: WarehouseInput,
  sel: ReturnType<typeof selectWarehouse>,
): WarehouseKpis {
  return {
    warehouseCount: input.warehouses.length,
    activeWarehouseCount: input.warehouses.filter((w) => w.status === "Active")
      .length,
    locationCount: sel.locations.length,
    putawayCount: sel.putaways.length,
    movementCount: sel.movements.length,
    pickingCount: sel.pickings.length,
    packingCount: sel.packings.length,
  };
}

export function computeWarehouseKpis(
  input: WarehouseInput,
  range: DateRange,
  filters: ReportFilters,
): WarehouseKpis {
  return warehouseKpis(input, selectWarehouse(input, range, filters));
}

export function computeWarehouseReport(
  input: WarehouseInput,
  range: DateRange,
  filters: ReportFilters,
): WarehouseReportData {
  const sel = selectWarehouse(input, range, filters);
  const warehouseById = new Map(input.warehouses.map((w) => [w.id, w]));

  const operations: Array<{ kind: OperationKind; createdAt: number }> = [
    ...sel.putaways.map((p) => ({
      kind: "Putaway" as const,
      createdAt: p.createdAt,
    })),
    ...sel.movements.map((m) => ({
      kind: "Movement" as const,
      createdAt: m.createdAt,
    })),
    ...sel.pickings.map((p) => ({
      kind: "Picking" as const,
      createdAt: p.createdAt,
    })),
    ...sel.packings.map((p) => ({
      kind: "Packing" as const,
      createdAt: p.createdAt,
    })),
  ];
  const operationsVolume = bucketSeriesByPeriod(
    operations,
    (o) => o.createdAt,
    pickGranularity(range),
    (): OperationSeries => ({
      Putaway: 0,
      Movement: 0,
      Picking: 0,
      Packing: 0,
    }),
    (b, o) => {
      b[o.kind] += 1;
    },
  );

  const stockByWarehouse = withKeyLabels(
    groupBy(
      input.stockBalances.filter((b) => matchWarehouse(b.warehouseId, filters)),
      (b) => warehouseName(warehouseById, b.warehouseId) || b.warehouseId,
      (b) => b.onHand || 0,
    ),
  );

  const occupiedByLocation = computeOccupancyByLocation(
    input.putaways,
    input.movements,
    input.pickings,
  );
  const rated = sel.locations
    .filter(
      (l): l is WarehouseLocation & { capacity: number } =>
        l.capacity != null && l.capacity > 0,
    )
    .map((l) => {
      const occupied = occupiedByLocation.get(l.id) || 0;
      return {
        key: l.id,
        label: l.locationCode || l.binCode || l.locationName || l.id,
        occupied,
        capacity: l.capacity,
        percent: (occupied / l.capacity) * 100,
      };
    });

  return {
    kpis: warehouseKpis(input, sel),
    operationsVolume,
    stockByWarehouse,
    locationUtilization:
      sel.locations.length > 0
        ? { rated, unratedCount: sel.locations.length - rated.length }
        : null,
  };
}
