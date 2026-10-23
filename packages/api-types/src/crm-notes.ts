// HANDWRITTEN — mirrors apps/api/src/modules/crm/notes/dto/note.dto.ts and
// apps/api/src/modules/crm/notes/notes.controller.ts. See
// packages/api-types/README.md.

/** Legacy `CrmNote` is scoped only to an Account — never polymorphic
 * `relatedType`/`relatedId` like Meeting/FollowUp/Activity/CrmTask/
 * CrmDocument — and has no update capability (add/delete only). */
export interface CrmNote {
  /** Resolved server-side from users.full_name (list responses). */
  createdByName?: string | null | undefined;
  updatedByName?: string | null | undefined;
  id: number;
  organizationId: number;
  accountId: number;
  content: string;
  createdBy: number | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface CreateCrmNoteInput {
  accountId: number;
  content: string;
}

/** `accountId` is a raw required query param on `GET /crm/notes`, not part
 * of the paginated query DTO's optional fields — kept required here to
 * match. */
export interface QueryCrmNotesInput {
  accountId: number;
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
}
