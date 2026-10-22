// Executive dashboard — the same per-domain KPI functions the drill-down reports use, so every
// headline number matches its report. Only KPIs are computed here, never charts or tables.
import type { DateRange } from "../reportHelpers";
import type { ReportFilters } from "./shared";
import {
  computeProcurementKpis,
  type ProcurementInput,
  type ProcurementKpis,
} from "./procurement";
import {
  computeInventoryKpis,
  type InventoryInput,
  type InventoryKpis,
} from "./inventory";
import {
  computeWarehouseKpis,
  type WarehouseInput,
  type WarehouseKpis,
} from "./warehouse";
import {
  computeFulfillmentKpis,
  type FulfillmentInput,
  type FulfillmentKpis,
} from "./fulfillment";
import {
  computeLogisticsKpis,
  type LogisticsInput,
  type LogisticsKpis,
} from "./logistics";
import {
  computeReturnsKpis,
  type ReturnsInput,
  type ReturnsKpis,
} from "./returns";
import {
  computeQualityKpis,
  type QualityInput,
  type QualityKpis,
} from "./quality";

export interface ExecutiveSummary {
  procurement: ProcurementKpis;
  inventory: InventoryKpis;
  warehouse: WarehouseKpis;
  fulfillment: FulfillmentKpis;
  logistics: LogisticsKpis;
  returns: ReturnsKpis;
  quality: QualityKpis;
}

type ExecutiveInput = ProcurementInput &
  InventoryInput &
  WarehouseInput &
  FulfillmentInput &
  LogisticsInput &
  ReturnsInput &
  QualityInput;

export function computeExecutiveSummary(
  data: ExecutiveInput,
  range: DateRange,
  filters: ReportFilters,
): ExecutiveSummary {
  return {
    procurement: computeProcurementKpis(data, range, filters),
    inventory: computeInventoryKpis(data, filters),
    warehouse: computeWarehouseKpis(data, range, filters),
    fulfillment: computeFulfillmentKpis(data, range, filters),
    logistics: computeLogisticsKpis(data, range, filters),
    returns: computeReturnsKpis(data, range, filters),
    quality: computeQualityKpis(data, range, filters),
  };
}
