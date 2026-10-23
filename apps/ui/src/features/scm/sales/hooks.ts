"use client";

import type {
  SalesOrder,
  SalesOrderPayload,
  ScmCustomer,
  ScmCustomerPayload,
} from "@texawave-erp/api-types";
import { scmGet, scmPatch, scmPost } from "../shared/scm-api";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";

export interface ListQuery {
  page: number;
  limit: number;
  q?: string | undefined;
  status?: string | undefined;
}

export const useCustomers = (q: ListQuery) =>
  useScmList<ScmCustomer>("customers", "/scm/customers", q);
export const useCustomerOptions = () =>
  useScmData<
    {
      id: number;
      customerCode: string;
      name: string;
      shippingAddress: string | null;
    }[]
  >("customers", ["options"], () => scmGet("/scm/customers/options"));
export const useCreateCustomer = () =>
  useScmMutation((input: ScmCustomerPayload) =>
    scmPost<ScmCustomer>("/scm/customers", input),
  );
export const useUpdateCustomer = () =>
  useScmMutation(({ id, input }: { id: number; input: ScmCustomerPayload }) =>
    scmPatch<ScmCustomer>(`/scm/customers/${id}`, input),
  );

export const useSalesOrders = (q: ListQuery) =>
  useScmList<SalesOrder>("sales-orders", "/scm/sales-orders", q);
export const useSalesOrder = (id: number | null) =>
  useScmData<SalesOrder>(
    "sales-orders",
    ["one", id ?? 0],
    () => scmGet(`/scm/sales-orders/${id}`),
    id !== null,
  );
export const useCreateSalesOrder = () =>
  useScmMutation((input: SalesOrderPayload) =>
    scmPost<SalesOrder>("/scm/sales-orders", input),
  );
export const useSalesOrderAction = () =>
  useScmMutation(
    ({ id, action }: { id: number; action: "confirm" | "cancel" }) =>
      scmPost<SalesOrder>(`/scm/sales-orders/${id}/${action}`),
  );
