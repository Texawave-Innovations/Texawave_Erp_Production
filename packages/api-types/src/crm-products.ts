// HANDWRITTEN — mirrors apps/api/src/modules/crm/products/. Migrated from
// the LIVE legacy TexaWave_ERP/src/modules/crm/Products.tsx +
// domain/productsService.ts. See packages/api-types/README.md.

export interface Product {
  id: number;
  organizationId: number;
  name: string;
  code: string;
  category: string | null;
  vendor: string | null;
  unitPrice: string;
  taxPercent: string | null;
  description: string | null;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateProductInput {
  name: string;
  code: string;
  category?: string | undefined;
  vendor?: string | undefined;
  unitPrice: number;
  taxPercent?: number | undefined;
  description?: string | undefined;
  isActive?: boolean | undefined;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface QueryProductsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  q?: string | undefined;
}
