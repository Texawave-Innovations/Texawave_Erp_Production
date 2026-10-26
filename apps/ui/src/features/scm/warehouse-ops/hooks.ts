"use client";

import type {
  AddPutawayLineInput,
  CreateMovementInput,
  CreatePutawayInput,
  LocationStockRow,
  Putaway,
  PutawaySource,
  RecordPutawayItemInput,
  ScmActivityRow,
  StockWriteOffInput,
  WarehouseStockViewRow,
  WarehouseMovement,
  WarehouseOpsDashboard,
} from "@texawave-erp/api-types";
import { scmDelete, scmGet, scmPost } from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

const W = "/scm/warehouse";

export const useWarehouseDashboard = () =>
  useScmData<WarehouseOpsDashboard>("warehouse-ops", ["dashboard"], () =>
    scmGet(`${W}/dashboard`),
  );
export const useWarehouseActivity = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
}) => useScmList<ScmActivityRow>("warehouse-ops", `${W}/activity`, q);
export const useLocationStock = (q: {
  page: number;
  limit: number;
  warehouseId?: number | undefined;
  q?: string | undefined;
}) => useScmList<LocationStockRow>("warehouse-ops", `${W}/location-stock`, q);

export const usePutaways = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: string | undefined;
  warehouseId?: number | undefined;
}) => useScmList<Putaway>("putaway", `${W}/putaway`, q);
export const usePutaway = (id: number | null) =>
  useScmData<Putaway>(
    "putaway",
    ["one", id ?? 0],
    () => scmGet(`${W}/putaway/${id}`),
    id !== null,
  );
export const usePutawaySources = () =>
  useScmData<PutawaySource[]>("putaway", ["sources"], () =>
    scmGet(`${W}/putaway/sources`),
  );
export const useCreatePutaway = () =>
  useScmMutation((input: CreatePutawayInput) =>
    scmPost<Putaway>(`${W}/putaway`, input),
  );
export const useAddPutawayLine = () =>
  useScmMutation(({ id, input }: { id: number; input: AddPutawayLineInput }) =>
    scmPost<Putaway>(`${W}/putaway/${id}/lines`, input),
  );
export const usePutawayAction = () =>
  useScmMutation(
    ({
      id,
      action,
      body,
    }: {
      id: number;
      action: "start" | "cancel";
      body?: object;
    }) => scmPost<Putaway>(`${W}/putaway/${id}/${action}`, body),
  );
export const useRecordPutawayItem = () =>
  useScmMutation(
    ({
      id,
      itemId,
      input,
    }: {
      id: number;
      itemId: number;
      input: RecordPutawayItemInput;
    }) => scmPost<Putaway>(`${W}/putaway/${id}/items/${itemId}`, input),
  );

export const useMovements = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: string | undefined;
  warehouseId?: number | undefined;
}) => useScmList<WarehouseMovement>("movements", `${W}/movements`, q);
export const useMovement = (id: number | null) =>
  useScmData<WarehouseMovement>(
    "movements",
    ["one", id ?? 0],
    () => scmGet(`${W}/movements/${id}`),
    id !== null,
  );
export const useCreateMovement = () =>
  useScmMutation((input: CreateMovementInput) =>
    scmPost<WarehouseMovement>(`${W}/movements`, input),
  );
export const useMovementAction = () =>
  useScmMutation(
    ({
      id,
      action,
      body,
    }: {
      id: number;
      action: "submit" | "approve" | "complete" | "cancel";
      body?: object;
    }) => scmPost<WarehouseMovement>(`${W}/movements/${id}/${action}`, body),
  );

export const useDeletePutaway = () =>
  useScmMutation((id: number) => scmDelete(`/scm/warehouse/putaway/${id}`));

export const useDeleteMovement = () =>
  useScmMutation((id: number) => scmDelete(`/scm/warehouse/movements/${id}`));

/** Stock by location incl. each warehouse's unassigned remainder. */
export const useStockView = (q: {
  warehouseId?: number | undefined;
  q?: string | undefined;
}) =>
  useScmData<WarehouseStockViewRow[]>("warehouse-ops", ["stock-view", q], () =>
    scmGet(`${W}/stock-view`, q),
  );
/** Writes stock off from a bin (a real ADJUSTMENT_OUT). */
export const useStockWriteOff = () =>
  useScmMutation((input: StockWriteOffInput) =>
    scmPost<{ ledgerEntryId: number }>(`${W}/stock-write-off`, input),
  );
