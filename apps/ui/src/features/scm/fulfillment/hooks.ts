"use client";

import type {
  Fulfillment,
  FulfillmentView,
  Packing,
  PackingPayload,
  Picking,
} from "@texawave-erp/api-types";
import { scmDelete, scmGet, scmPost } from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

export interface FulfillmentQuery {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: string | undefined;
  view?: FulfillmentView | undefined;
}

export const useFulfillments = (q: FulfillmentQuery) =>
  useScmList<Fulfillment>("fulfillments", "/scm/fulfillments", q);
export const useFulfillment = (id: number | null) =>
  useScmData<Fulfillment>(
    "fulfillments",
    ["one", id ?? 0],
    () => scmGet(`/scm/fulfillments/${id}`),
    id !== null,
  );
export const useCreateFulfillment = () =>
  useScmMutation((input: { salesOrderId: number; warehouseId: number }) =>
    scmPost<Fulfillment>("/scm/fulfillments", input),
  );
export const useFulfillmentAction = () =>
  useScmMutation(
    ({
      id,
      action,
      reason,
    }: {
      id: number;
      action:
        | "reserve"
        | "release"
        | "pick-list"
        | "shortage-requisition"
        | "finalize"
        | "cancel";
      reason?: string;
    }) =>
      scmPost<Fulfillment>(
        `/scm/fulfillments/${id}/${action}`,
        reason !== undefined ? { reason } : undefined,
      ),
  );

export const usePickings = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: string | undefined;
  packable?: string | undefined;
}) => useScmList<Picking>("pickings", "/scm/pickings", q);
export const usePickingAction = () =>
  useScmMutation(
    ({
      id,
      action,
      body,
    }: {
      id: number;
      action: "start" | "assign" | "record" | "cancel";
      body?: object;
    }) => scmPost<Picking>(`/scm/pickings/${id}/${action}`, body),
  );

export const usePackings = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: string | undefined;
}) => useScmList<Packing>("packings", "/scm/packings", q);
export const useCreatePacking = () =>
  useScmMutation((input: PackingPayload) =>
    scmPost<Packing>("/scm/packings", input),
  );
export const usePackingAction = () =>
  useScmMutation(({ id, action }: { id: number; action: "cancel" }) =>
    scmPost<Packing>(`/scm/packings/${id}/${action}`),
  );

export const useDeleteFulfillment = () =>
  useScmMutation((id: number) => scmDelete(`/scm/fulfillments/${id}`));

export const useDeletePicking = () =>
  useScmMutation((id: number) => scmDelete(`/scm/pickings/${id}`));

export const useDeletePacking = () =>
  useScmMutation((id: number) => scmDelete(`/scm/packings/${id}`));
