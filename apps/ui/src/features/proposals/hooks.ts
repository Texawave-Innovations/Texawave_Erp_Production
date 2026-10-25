"use client";

import type {
  CreateProposalDocumentInput,
  CreateProposalTemplateInput,
  ExtendFollowupInput,
  QueryProposalDocumentsInput,
  TransitionProposalInput,
  UpdateProposalDocumentInput,
  UpdateProposalSettingsInput,
  UpdateProposalTemplateInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createProposalDocument,
  createProposalTemplate,
  createProposalTemplateVersion,
  duplicateProposalDocument,
  duplicateProposalTemplate,
  getProposalStats,
  publishProposalTemplate,
  deleteProposalDocument,
  deleteProposalTemplate,
  extendProposalFollowup,
  getProposalDocument,
  getProposalSettings,
  getProposalTemplate,
  listProposalDocuments,
  listProposalTemplates,
  transitionProposalDocument,
  updateProposalDocument,
  updateProposalSettings,
  updateProposalTemplate,
} from "./api";

const DOCUMENTS_KEY = "proposal-documents";
const TEMPLATES_KEY = "proposal-templates";
const SETTINGS_KEY = "proposal-settings";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useProposalDocuments(query: QueryProposalDocumentsInput = {}) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DOCUMENTS_KEY, "list", query),
    queryFn: () => listProposalDocuments(query),
    enabled: orgId > 0,
  });
}

export function useProposalStats() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DOCUMENTS_KEY, "stats"),
    queryFn: () => getProposalStats(),
    enabled: orgId > 0,
  });
}

export function useDuplicateProposalDocument() {
  return useOrgScopedMutation([DOCUMENTS_KEY], (id: number) =>
    duplicateProposalDocument(id),
  );
}

export function useProposalDocument(id: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DOCUMENTS_KEY, "detail", id),
    queryFn: () => getProposalDocument(id),
    enabled: orgId > 0 && Number.isInteger(id) && id > 0,
  });
}

export function useCreateProposalDocument() {
  return useOrgScopedMutation(
    [DOCUMENTS_KEY],
    (input: CreateProposalDocumentInput) => createProposalDocument(input),
  );
}

export function useUpdateProposalDocument() {
  return useOrgScopedMutation(
    [DOCUMENTS_KEY],
    ({ id, input }: { id: number; input: UpdateProposalDocumentInput }) =>
      updateProposalDocument(id, input),
  );
}

export function useTransitionProposalDocument() {
  return useOrgScopedMutation(
    [DOCUMENTS_KEY],
    ({ id, input }: { id: number; input: TransitionProposalInput }) =>
      transitionProposalDocument(id, input),
  );
}

export function useExtendProposalFollowup() {
  return useOrgScopedMutation(
    [DOCUMENTS_KEY],
    ({ id, input }: { id: number; input: ExtendFollowupInput }) =>
      extendProposalFollowup(id, input),
  );
}

export function useDeleteProposalDocument() {
  return useOrgScopedMutation([DOCUMENTS_KEY], (id: number) =>
    deleteProposalDocument(id),
  );
}

export function useProposalTemplates() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, TEMPLATES_KEY, "list"),
    queryFn: () => listProposalTemplates(),
    enabled: orgId > 0,
  });
}

export function useProposalTemplate(id: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, TEMPLATES_KEY, "detail", id),
    queryFn: () => getProposalTemplate(id),
    enabled: orgId > 0 && Number.isInteger(id) && id > 0,
  });
}

export function useCreateProposalTemplate() {
  return useOrgScopedMutation(
    [TEMPLATES_KEY],
    (input: CreateProposalTemplateInput) => createProposalTemplate(input),
  );
}

export function useUpdateProposalTemplate() {
  return useOrgScopedMutation(
    [TEMPLATES_KEY],
    ({ id, input }: { id: number; input: UpdateProposalTemplateInput }) =>
      updateProposalTemplate(id, input),
  );
}

export function useDeleteProposalTemplate() {
  return useOrgScopedMutation([TEMPLATES_KEY], (id: number) =>
    deleteProposalTemplate(id),
  );
}

/** `enabled` lets other features (e.g. MoM's company header) read the shared
 * branding only when the caller holds `projects.proposals.read`. */
export function useProposalSettings(options: { enabled?: boolean } = {}) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, SETTINGS_KEY),
    queryFn: () => getProposalSettings(),
    enabled: orgId > 0 && (options.enabled ?? true),
  });
}

export function useUpdateProposalSettings() {
  return useOrgScopedMutation(
    [SETTINGS_KEY],
    (input: UpdateProposalSettingsInput) => updateProposalSettings(input),
  );
}

export function usePublishProposalTemplate() {
  return useOrgScopedMutation([TEMPLATES_KEY], (id: number) =>
    publishProposalTemplate(id),
  );
}

export function useDuplicateProposalTemplate() {
  return useOrgScopedMutation([TEMPLATES_KEY], (id: number) =>
    duplicateProposalTemplate(id),
  );
}

export function useCreateProposalTemplateVersion() {
  return useOrgScopedMutation([TEMPLATES_KEY], (id: number) =>
    createProposalTemplateVersion(id),
  );
}
