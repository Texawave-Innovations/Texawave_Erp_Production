// HANDWRITTEN — mirrors apps/api/src/modules/_reference/tags/ (the fixture
// reference feature, not a real business concept). See
// packages/api-types/README.md.

export const TAG_COLOR_TOKENS = [
  "brand",
  "gray",
  "success",
  "warning",
  "error",
] as const;
export type TagColorToken = (typeof TAG_COLOR_TOKENS)[number];

export interface Tag {
  id: string;
  organizationId: string;
  name: string;
  colorToken: TagColorToken;
  customFields: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateTagInput {
  name: string;
  colorToken?: TagColorToken;
  customFields?: Record<string, unknown>;
}

export type UpdateTagInput = Partial<CreateTagInput>;

export interface QueryTagsInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
}
