"use client";

import type {
  CreateScmProductInput,
  QueryScmProductsInput,
  ScmProduct,
  UpdateScmProductInput,
} from "@texawave-erp/api-types";
import { scmDelete, scmPatch, scmPost } from "../shared/scm-api";
import { useScmList, useScmMutation } from "../shared/scm-hooks";

export const useScmProducts = (q: QueryScmProductsInput) =>
  useScmList<ScmProduct>("products", "/scm/products", q);

export const useCreateScmProduct = () =>
  useScmMutation((input: CreateScmProductInput) =>
    scmPost<ScmProduct>("/scm/products", input),
  );

export const useUpdateScmProduct = () =>
  useScmMutation(
    ({ id, input }: { id: number; input: UpdateScmProductInput }) =>
      scmPatch<ScmProduct>(`/scm/products/${id}`, input),
  );

export const useDeleteScmProduct = () =>
  useScmMutation((id: number) => scmDelete(`/scm/products/${id}`));
