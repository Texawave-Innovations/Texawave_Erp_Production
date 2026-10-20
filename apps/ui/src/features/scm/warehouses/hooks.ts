"use client";

import type {
  CreateLocationInput,
  CreateWarehouseInput,
  QueryLocationsInput,
  QueryWarehousesInput,
  ScmLocation,
  ScmWarehouse,
  UpdateLocationInput,
  UpdateWarehouseInput,
} from "@texawave-erp/api-types";
import { scmPatch, scmPost } from "../shared/scm-api";
import { useScmList, useScmMutation } from "../shared/scm-hooks";

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
