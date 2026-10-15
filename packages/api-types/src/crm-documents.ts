// HANDWRITTEN — mirrors
// apps/api/src/modules/crm/documents/dto/document.dto.ts and
// apps/api/src/modules/crm/documents/documents.controller.ts. See
// packages/api-types/README.md.

import type { RelatedType } from "./crm-related-entity.js";

/** Legacy `CrmDocument` is name + external link only — no real file
 * upload, no update endpoint. Reproduced the same way: create/list/delete
 * only. */
export interface CrmDocument {
  id: number;
  organizationId: number;
  relatedType: RelatedType;
  relatedId: number;
  name: string;
  link: string;
  notes: string | null;
  uploadedBy: number | null;
  uploadedAt: string;
  deletedAt: string | null;
}

export interface CreateCrmDocumentInput {
  relatedType: RelatedType;
  relatedId: number;
  name: string;
  link: string;
  notes?: string | undefined;
}

export interface QueryCrmDocumentsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  relatedType?: RelatedType | undefined;
  relatedId?: number | undefined;
}
