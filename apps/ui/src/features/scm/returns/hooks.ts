"use client";

import type {
  CompleteReturnInspectionInput,
  CreateCustomerReturnInput,
  CreateVendorReturnInput,
  CustomerReturnSource,
  QueryReturnInput,
  ReceiveReturnInput,
  ReturnDispositionInput,
  ReturnsDashboard,
  ScmReturn,
  ShipVendorReturnInput,
  VendorReturnSource,
} from "@texawave-erp/api-types";
import { scmGet, scmPost } from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

const R = "/scm/returns";

export const useReturns = (q: QueryReturnInput) =>
  useScmList<ScmReturn>("returns", R, q);
export const useReturn = (id: number | null) =>
  useScmData<ScmReturn>(
    "returns",
    ["one", id ?? 0],
    () => scmGet(`${R}/${id}`),
    id !== null,
  );
export const useReturnsDashboard = () =>
  useScmData<ReturnsDashboard>("returns", ["dashboard"], () =>
    scmGet(`${R}/dashboard`),
  );
export const useCustomerReturnSources = () =>
  useScmData<CustomerReturnSource[]>("returns", ["customer-sources"], () =>
    scmGet(`${R}/customer-sources`),
  );
export const useVendorReturnSources = () =>
  useScmData<VendorReturnSource[]>("returns", ["vendor-sources"], () =>
    scmGet(`${R}/vendor-sources`),
  );

export const useCreateCustomerReturn = () =>
  useScmMutation((input: CreateCustomerReturnInput) =>
    scmPost<ScmReturn>(`${R}/customer`, input),
  );
export const useCreateVendorReturn = () =>
  useScmMutation((input: CreateVendorReturnInput) =>
    scmPost<ScmReturn>(`${R}/vendor`, input),
  );

export const useReturnAction = () =>
  useScmMutation(
    ({
      id,
      action,
      body,
    }: {
      id: number;
      action:
        | "submit"
        | "approve"
        | "reject"
        | "cancel"
        | "in-transit"
        | "start-inspection"
        | "to-disposition"
        | "ready-to-ship"
        | "vendor-received"
        | "complete";
      body?: object | undefined;
    }) => scmPost<ScmReturn>(`${R}/${id}/${action}`, body),
  );
export const useReceiveReturn = () =>
  useScmMutation(({ id, input }: { id: number; input: ReceiveReturnInput }) =>
    scmPost<ScmReturn>(`${R}/${id}/receive`, input),
  );
export const useInspectReturn = () =>
  useScmMutation(
    ({ id, input }: { id: number; input: CompleteReturnInspectionInput }) =>
      scmPost<ScmReturn>(`${R}/${id}/inspect`, input),
  );
export const useDispositionReturn = () =>
  useScmMutation(
    ({ id, input }: { id: number; input: ReturnDispositionInput }) =>
      scmPost<ScmReturn>(`${R}/${id}/disposition`, input),
  );
export const useShipVendorReturn = () =>
  useScmMutation(
    ({ id, input }: { id: number; input: ShipVendorReturnInput }) =>
      scmPost<ScmReturn>(`${R}/${id}/ship`, input),
  );
