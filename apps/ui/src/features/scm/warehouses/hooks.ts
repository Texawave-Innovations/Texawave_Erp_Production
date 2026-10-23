"use client";

import type {
  CreateLocationInput,
  LocationStockEntry,
  CreateWarehouseInput,
  QueryLocationsInput,
  QueryWarehousesInput,
  ScmLocation,
  ScmWarehouse,
  UpdateLocationInput,
  UpdateWarehouseInput,
} from "@texawave-erp/api-types";
import {
  scmDelete,
  scmDeleteData,
  scmGet,
  scmPatch,
  scmPost,
} from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

export const useWarehouses = (q: QueryWarehousesInput) =>
  useScmList<ScmWarehouse>("warehouses", "/scm/warehouses", q);
export const useCreateWarehouse = () =>
  useScmMutation((input: CreateWarehouseInput) =>
    scmPost<ScmWarehouse>("/scm/warehouses", input),
  );
export const useUpdateWarehouse = () =>
  useScmMutation(({ id, input }: { id: number; input: UpdateWarehouseInput }) =>
    scmPatch<ScmWarehouse>(`/scm/warehouses/${id}`, input),
  );

export const useLocations = (q: QueryLocationsInput) =>
  useScmList<ScmLocation>("locations", "/scm/warehouse-locations", q);
export const useCreateLocation = () =>
  useScmMutation((input: CreateLocationInput) =>
    scmPost<ScmLocation>("/scm/warehouse-locations", input),
  );
export const useUpdateLocation = () =>
  useScmMutation(({ id, input }: { id: number; input: UpdateLocationInput }) =>
    scmPatch<ScmLocation>(`/scm/warehouse-locations/${id}`, input),
  );

export const useDeleteWarehouse = () =>
  useScmMutation((id: number) => scmDelete(`/scm/warehouses/${id}`));

/** Deletes the location and everything nested under it; `force` overrides the
 * "stock is recorded here" refusal. */
export const useDeleteLocation = () =>
  useScmMutation(({ id, force }: { id: number; force?: boolean }) =>
    scmDeleteData<{ deleted: number; nested: number }>(
      `/scm/warehouse-locations/${id}${force ? "?force=true" : ""}`,
    ),
  );

/** Stock stored per location (non-zero rows), for occupancy and detail views. */
export const useLocationStock = (warehouseId?: number) =>
  useScmData<LocationStockEntry[]>(
    "locations",
    ["stock", warehouseId ?? 0],
    () =>
      scmGet(
        "/scm/warehouse-locations/stock",
        warehouseId ? { warehouseId } : undefined,
      ),
  );
