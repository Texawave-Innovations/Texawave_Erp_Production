// HANDWRITTEN — mirrors apps/api/src/modules/crm/accounts/. Minimal CRM
// Account foundation (Phase 4B): only the fields legacy Contacts.tsx reads
// off an account (`id`, `name`). See packages/api-types/README.md.

export interface Account {
  id: number;
  organizationId: number;
  teamId: number | null;
  name: string;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateAccountInput {
  name: string;
}

export type UpdateAccountInput = Partial<CreateAccountInput>;

export interface QueryAccountsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  search?: string | undefined;
}
