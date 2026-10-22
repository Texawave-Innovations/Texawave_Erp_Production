"use client";

import type {
  FulfillmentReportRow,
  InventoryReportRow,
  LogisticsReportRow,
  ProcurementReportRow,
  QualityReportRow,
  ReportQuery,
  ReportsOverview,
  ReturnsReportRow,
  SupplierReportRow,
  WarehouseReportRow,
} from "@texawave-erp/api-types";
import { scmGet } from "../shared/scm-api";
import { useScmData } from "../shared/scm-hooks";

const R = "/scm/reports";

export const useReportsOverview = () =>
  useScmData<ReportsOverview>("reports", ["overview"], () => scmGet(R));
export const useProcurementReport = (q: ReportQuery) =>
  useScmData<ProcurementReportRow[]>("reports", ["procurement", q], () =>
    scmGet(`${R}/procurement`, q),
  );
export const useInventoryReport = (q: ReportQuery) =>
  useScmData<InventoryReportRow[]>("reports", ["inventory", q], () =>
    scmGet(`${R}/inventory`, q),
  );
export const useWarehouseReport = () =>
  useScmData<WarehouseReportRow[]>("reports", ["warehouse"], () =>
    scmGet(`${R}/warehouse`),
  );
export const useFulfillmentReport = (q: ReportQuery) =>
  useScmData<FulfillmentReportRow[]>("reports", ["fulfillment", q], () =>
    scmGet(`${R}/fulfillment`, q),
  );
export const useLogisticsReport = (q: ReportQuery) =>
  useScmData<LogisticsReportRow[]>("reports", ["logistics", q], () =>
    scmGet(`${R}/logistics`, q),
  );
export const useReturnsReport = (q: ReportQuery) =>
  useScmData<ReturnsReportRow[]>("reports", ["returns", q], () =>
    scmGet(`${R}/returns`, q),
  );
export const useQualityReport = (q: ReportQuery) =>
  useScmData<QualityReportRow[]>("reports", ["quality", q], () =>
    scmGet(`${R}/quality`, q),
  );
export const useSuppliersReport = () =>
  useScmData<SupplierReportRow[]>("reports", ["suppliers"], () =>
    scmGet(`${R}/suppliers`),
  );
