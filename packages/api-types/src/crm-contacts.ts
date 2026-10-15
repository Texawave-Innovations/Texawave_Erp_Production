// HANDWRITTEN — mirrors apps/api/src/modules/crm/contacts/. Migrated from
// the LIVE legacy TexaWave_ERP/src/modules/crm/domain/contactsService.ts
// (RTDB `crm/contacts`). See packages/api-types/README.md.

import type { Account } from "./crm-accounts.js";

export interface Contact {
  id: number;
  organizationId: number;
  teamId: number | null;
  accountId: number;
  account: Pick<Account, "id" | "name">;
  name: string;
  designation: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  isPrimary: boolean;
  isDecisionMaker: boolean;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateContactInput {
  accountId: number;
  name: string;
  designation?: string | undefined;
  department?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  whatsapp?: string | undefined;
  isPrimary?: boolean | undefined;
  isDecisionMaker?: boolean | undefined;
}

export type UpdateContactInput = Partial<CreateContactInput>;

export interface QueryContactsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  q?: string | undefined;
  accountId?: number | undefined;
  isPrimary?: boolean | undefined;
  isDecisionMaker?: boolean | undefined;
}
