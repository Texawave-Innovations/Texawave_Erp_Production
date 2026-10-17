"use client";

import type {
  CreateProductInput,
  QueryProductsInput,
  UpdateProductInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "./api";

function productsKey(organizationId: number, query: QueryProductsInput) {
  return orgScopedKey(organizationId, "crm-products", query);
}

export function useProducts(query: QueryProductsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: productsKey(organizationId ?? 0, query),
    queryFn: () => listProducts(query),
    enabled: Boolean(organizationId),
  });
}

function useInvalidateProducts() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-products"),
    });
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: invalidate,
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateProductInput }) =>
      updateProduct(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: invalidate,
  });
}
