"use client";

import type {
  CreateAdjustmentInput,
  CreateBatchInput,
  CreateReservationInput,
  CreateSerialsInput,
  CreateTransferInput,
  InventoryKpis,
  InventoryProductDetail,
  InventoryRow,
  LedgerEntry,
  OpeningBalanceInput,
  QueryInventoryDocsInput,
  QueryLedgerInput,
  QueryOverviewInput,
  ScmAdjustment,
  ScmBatch,
  ScmReservation,
  ScmSerial,
  ScmTransfer,
} from "@texawave-erp/api-types";
import { scmGet, scmPatch, scmPost } from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

const BASE = "/scm/inventory";

export const useOverview = (q: QueryOverviewInput) =>
  useScmList<InventoryRow>("inventory", `${BASE}/overview`, q);

export const useOverviewKpis = (q: QueryOverviewInput) =>
  useScmData<InventoryKpis>("inventory", ["kpis", q], () =>
    scmGet(`${BASE}/overview/kpis`, q),
  );

export const useInventoryProductDetail = (productId: number) =>
  useScmData<InventoryProductDetail>("inventory", ["detail", productId], () =>
    scmGet(`${BASE}/overview/${productId}`),
  );

export const useLedger = (q: QueryLedgerInput) =>
  useScmList<LedgerEntry>("ledger", `${BASE}/ledger`, q);

export const useReservations = (q: QueryInventoryDocsInput) =>
  useScmList<ScmReservation>("reservations", `${BASE}/reservations`, q);
export const useTransfers = (q: QueryInventoryDocsInput) =>
  useScmList<ScmTransfer>("transfers", `${BASE}/transfers`, q);
export const useAdjustments = (q: QueryInventoryDocsInput) =>
  useScmList<ScmAdjustment>("adjustments", `${BASE}/adjustments`, q);
export const useBatches = (q: QueryInventoryDocsInput) =>
  useScmList<ScmBatch>("batches", `${BASE}/batches`, q);
export const useSerials = (q: QueryInventoryDocsInput) =>
  useScmList<ScmSerial>("serials", `${BASE}/serials`, q);

export const usePostOpeningBalance = () =>
  useScmMutation((input: OpeningBalanceInput) =>
    scmPost(`${BASE}/opening-balance`, input),
  );
export const useCreateReservation = () =>
  useScmMutation((input: CreateReservationInput) =>
    scmPost<ScmReservation>(`${BASE}/reservations`, input),
  );
export const useReleaseReservation = () =>
  useScmMutation(
    ({ id, status }: { id: number; status: "RELEASED" | "CANCELLED" }) =>
      scmPost<ScmReservation>(`${BASE}/reservations/${id}/release`, { status }),
  );
export const useCreateTransfer = () =>
  useScmMutation((input: CreateTransferInput) =>
    scmPost<ScmTransfer>(`${BASE}/transfers`, input),
  );
export const useTransferAction = () =>
  useScmMutation(
    ({
      id,
      action,
    }: {
      id: number;
      action: "approve" | "dispatch" | "receive" | "cancel";
    }) => scmPost<ScmTransfer>(`${BASE}/transfers/${id}/${action}`),
  );
export const useCreateAdjustment = () =>
  useScmMutation((input: CreateAdjustmentInput) =>
    scmPost<ScmAdjustment>(`${BASE}/adjustments`, input),
  );
export const useAdjustmentDecision = () =>
  useScmMutation(
    ({ id, decision }: { id: number; decision: "approve" | "reject" }) =>
      scmPost<ScmAdjustment>(`${BASE}/adjustments/${id}/${decision}`),
  );
export const useCreateBatch = () =>
  useScmMutation((input: CreateBatchInput) =>
    scmPost<ScmBatch>(`${BASE}/batches`, input),
  );
export const useSetBatchStatus = () =>
  useScmMutation(({ id, status }: { id: number; status: string }) =>
    scmPatch<ScmBatch>(`${BASE}/batches/${id}/status`, { status }),
  );
export const useCreateSerials = () =>
  useScmMutation((input: CreateSerialsInput) =>
    scmPost<{ created: number }>(`${BASE}/serials`, input),
  );
export const useSetSerialStatus = () =>
  useScmMutation(({ id, status }: { id: number; status: string }) =>
    scmPatch<ScmSerial>(`${BASE}/serials/${id}/status`, { status }),
  );
