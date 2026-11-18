"use client";

import type {
  CreateSupplierBillInput,
  CreateSupplierPaymentInput,
  PostSupplierBillToFinanceInput,
  QuerySupplierBillsInput,
  QuerySupplierPaymentsInput,
  SupplierBill,
  SupplierDocumentType,
  SupplierPayment,
  UpdateSupplierBillInput,
} from "@texawave-erp/api-types";
import { useScmData, useScmList, useScmMutation } from "../shared/scm-hooks";
import {
  cancelSupplierBill,
  postSupplierBillToFinance,
  createSupplierBill,
  createSupplierPayment,
  getSupplierFinanceSummary,
  listSupplierDocuments,
  removeSupplierDocument,
  updateSupplierBill,
  uploadSupplierDocument,
  voidSupplierPayment,
} from "./finance-api";

export const useSupplierBills = (
  query: QuerySupplierBillsInput,
  enabled = true,
) =>
  useScmList<SupplierBill>(
    "finance-bills",
    "/scm/finance/bills",
    query,
    enabled,
  );

export const useSupplierPayments = (query: QuerySupplierPaymentsInput) =>
  useScmList<SupplierPayment>(
    "finance-payments",
    "/scm/finance/payments",
    query,
  );

export const useSupplierFinanceSummary = (supplierId: number) =>
  useScmData("finance-summary", [supplierId], () =>
    getSupplierFinanceSummary(supplierId),
  );

export const useSupplierDocuments = (supplierId: number) =>
  useScmData("supplier-documents", [supplierId], () =>
    listSupplierDocuments(supplierId),
  );

export const useCreateSupplierBill = () =>
  useScmMutation((input: CreateSupplierBillInput) => createSupplierBill(input));

export const useUpdateSupplierBill = () =>
  useScmMutation(
    ({ id, input }: { id: number; input: UpdateSupplierBillInput }) =>
      updateSupplierBill(id, input),
  );

export const useCancelSupplierBill = () =>
  useScmMutation(({ id, reason }: { id: number; reason: string }) =>
    cancelSupplierBill(id, reason),
  );

export const usePostSupplierBillToFinance = () =>
  useScmMutation(
    ({ id, input }: { id: number; input?: PostSupplierBillToFinanceInput }) =>
      postSupplierBillToFinance(id, input),
  );

export const useCreateSupplierPayment = () =>
  useScmMutation((input: CreateSupplierPaymentInput) =>
    createSupplierPayment(input),
  );

export const useVoidSupplierPayment = () =>
  useScmMutation(({ id, reason }: { id: number; reason: string }) =>
    voidSupplierPayment(id, reason),
  );

export const useUploadSupplierDocument = () =>
  useScmMutation(
    ({
      supplierId,
      ...input
    }: {
      supplierId: number;
      file: File;
      name?: string;
      documentType?: SupplierDocumentType;
    }) => uploadSupplierDocument(supplierId, input),
  );

export const useRemoveSupplierDocument = () =>
  useScmMutation(({ supplierId, id }: { supplierId: number; id: number }) =>
    removeSupplierDocument(supplierId, id),
  );
