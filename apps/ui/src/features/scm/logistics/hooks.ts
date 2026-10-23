"use client";

import type {
  Carrier,
  Shipment,
  ShipmentTrackingEvent,
  ShippableFulfillment,
} from "@texawave-erp/api-types";
import { scmDelete, scmGet, scmPatch, scmPost } from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

export const useCarriers = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: string | undefined;
}) => useScmList<Carrier>("carriers", "/scm/carriers", q);
export const useCarrierOptions = () =>
  useScmData<{ id: number; carrierCode: string; carrierName: string }[]>(
    "carriers",
    ["options"],
    () => scmGet("/scm/carriers/options"),
  );
export const useSaveCarrier = () =>
  useScmMutation(({ id, input }: { id?: number; input: object }) =>
    id
      ? scmPatch<Carrier>(`/scm/carriers/${id}`, input)
      : scmPost<Carrier>("/scm/carriers", input),
  );

export const useShipments = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: string | undefined;
}) => useScmList<Shipment>("shipments", "/scm/shipments", q);
export const useShipment = (id: number | null) =>
  useScmData<Shipment>(
    "shipments",
    ["one", id ?? 0],
    () => scmGet(`/scm/shipments/${id}`),
    id !== null,
  );
export const useShippable = () =>
  useScmData<ShippableFulfillment[]>("shipments", ["shippable"], () =>
    scmGet("/scm/shipments/shippable"),
  );
export const useTrackingEvents = (q: {
  page: number;
  limit: number;
  q?: string | undefined;
}) =>
  useScmList<ShipmentTrackingEvent>(
    "shipments",
    "/scm/shipments/tracking-events",
    q,
  );
export const useCreateShipment = () =>
  useScmMutation((input: { fulfillmentId: number; packingIds: number[] }) =>
    scmPost<Shipment>("/scm/shipments", input),
  );
export const useShipmentAction = () =>
  useScmMutation(
    ({ id, action, body }: { id: number; action: string; body?: object }) =>
      scmPost<Shipment>(`/scm/shipments/${id}/${action}`, body),
  );

export const useDeleteCarrier = () =>
  useScmMutation((id: number) => scmDelete(`/scm/carriers/${id}`));

export const useDeleteShipment = () =>
  useScmMutation((id: number) => scmDelete(`/scm/shipments/${id}`));
