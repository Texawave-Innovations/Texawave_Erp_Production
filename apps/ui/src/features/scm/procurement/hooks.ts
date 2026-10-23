"use client";

import type {
  CreateGoodsReceiptInput,
  CreatePurchaseOrderInput,
  CreateQuotationInput,
  CreateRfqInput,
  GoodsReceipt,
  ProcurementDashboardSummary,
  PurchaseOrder,
  PurchaseRequisition,
  QueryGoodsReceiptsInput,
  QueryPurchaseOrdersInput,
  QueryRequisitionsInput,
  QueryRfqsInput,
  QueryScmQuotationsInput,
  QuotationComparisonRecord,
  RequisitionPayload,
  Rfq,
  SupplierQuotation,
} from "@texawave-erp/api-types";
import { scmGet, scmPost, scmPut } from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

const P = "/scm/procurement";

export const useProcurementDashboard = () =>
  useScmData<ProcurementDashboardSummary>("procurement", ["dashboard"], () =>
    scmGet(`${P}/dashboard`),
  );

// ---- requisitions ---------------------------------------------------------
export const useRequisitions = (q: QueryRequisitionsInput) =>
  useScmList<PurchaseRequisition>("requisitions", `${P}/requisitions`, q);
export const useRequisition = (id: number | null) =>
  useScmData<PurchaseRequisition>(
    "requisitions",
    ["one", id ?? 0],
    () => scmGet(`${P}/requisitions/${id}`),
    id !== null,
  );
export const useCreateRequisition = () =>
  useScmMutation((input: RequisitionPayload) =>
    scmPost<PurchaseRequisition>(`${P}/requisitions`, input),
  );
export const useUpdateRequisition = () =>
  useScmMutation(({ id, input }: { id: number; input: RequisitionPayload }) =>
    scmPut<PurchaseRequisition>(`${P}/requisitions/${id}`, input),
  );
export const useRequisitionAction = () =>
  useScmMutation(
    ({
      id,
      action,
      reason,
    }: {
      id: number;
      action: "submit" | "approve" | "reject" | "cancel";
      reason?: string;
    }) =>
      scmPost<PurchaseRequisition>(
        `${P}/requisitions/${id}/${action}`,
        reason !== undefined ? { reason } : undefined,
      ),
  );

// ---- rfqs -----------------------------------------------------------------
export const useRfqs = (q: QueryRfqsInput) =>
  useScmList<Rfq>("rfqs", `${P}/rfqs`, q);
export const useRfqsWithQuotations = () =>
  useScmData<{ id: number; rfqNumber: string; status: string }[]>(
    "rfqs",
    ["with-quotations"],
    () => scmGet(`${P}/rfqs/with-quotations`),
  );
export const useCreateRfq = () =>
  useScmMutation((input: CreateRfqInput) => scmPost<Rfq>(`${P}/rfqs`, input));
export const useRfqAction = () =>
  useScmMutation(
    ({ id, action }: { id: number; action: "issue" | "close" | "cancel" }) =>
      scmPost<Rfq>(`${P}/rfqs/${id}/${action}`),
  );

// ---- quotations -----------------------------------------------------------
export const useQuotations = (q: QueryScmQuotationsInput) =>
  useScmList<SupplierQuotation>("quotations", `${P}/quotations`, q);
export const useQuotation = (id: number | null) =>
  useScmData<SupplierQuotation>(
    "quotations",
    ["one", id ?? 0],
    () => scmGet(`${P}/quotations/${id}`),
    id !== null,
  );
export const useCreateQuotation = () =>
  useScmMutation((input: CreateQuotationInput) =>
    scmPost<SupplierQuotation>(`${P}/quotations`, input),
  );
export const useQuotationAction = () =>
  useScmMutation(
    ({ id, action }: { id: number; action: "reject" | "cancel" }) =>
      scmPost<SupplierQuotation>(`${P}/quotations/${id}/${action}`),
  );
export const useComparison = (rfqId: number | null) =>
  useScmData<SupplierQuotation[]>(
    "quotations",
    ["comparison", rfqId ?? 0],
    () => scmGet(`${P}/comparison/${rfqId}`),
    rfqId !== null,
  );
export const useComparisonHistory = (rfqId: number | null) =>
  useScmData<QuotationComparisonRecord[]>(
    "quotations",
    ["comparison-history", rfqId ?? 0],
    () => scmGet(`${P}/comparison/${rfqId}/history`),
    rfqId !== null,
  );
export const useSaveComparison = () =>
  useScmMutation(
    (input: {
      rfqId: number;
      selectedQuotationId?: number;
      remarks?: string;
    }) => scmPost<QuotationComparisonRecord>(`${P}/comparison`, input),
  );

// ---- purchase orders ------------------------------------------------------
export const usePurchaseOrders = (q: QueryPurchaseOrdersInput) =>
  useScmList<PurchaseOrder>("purchase-orders", `${P}/purchase-orders`, q);
export const usePurchaseOrder = (id: number | null) =>
  useScmData<PurchaseOrder>(
    "purchase-orders",
    ["one", id ?? 0],
    () => scmGet(`${P}/purchase-orders/${id}`),
    id !== null,
  );
export const useCreatePurchaseOrder = () =>
  useScmMutation((input: CreatePurchaseOrderInput) =>
    scmPost<PurchaseOrder>(`${P}/purchase-orders`, input),
  );
export const usePurchaseOrderAction = () =>
  useScmMutation(
    ({
      id,
      action,
    }: {
      id: number;
      action: "submit" | "approve" | "send" | "cancel" | "close";
    }) => scmPost<PurchaseOrder>(`${P}/purchase-orders/${id}/${action}`),
  );

// ---- goods receipts -------------------------------------------------------
export const useGoodsReceipts = (q: QueryGoodsReceiptsInput) =>
  useScmList<GoodsReceipt>("goods-receipts", `${P}/goods-receipts`, q);
export const useGoodsReceipt = (id: number | null) =>
  useScmData<GoodsReceipt>(
    "goods-receipts",
    ["one", id ?? 0],
    () => scmGet(`${P}/goods-receipts/${id}`),
    id !== null,
  );
export const useCreateGoodsReceipt = () =>
  useScmMutation((input: CreateGoodsReceiptInput) =>
    scmPost<GoodsReceipt>(`${P}/goods-receipts`, input),
  );
