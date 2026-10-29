"use client";

import type {
  CreateMomDocumentInput,
  CreateMomTemplateInput,
  QueryMomDocumentsInput,
  StartMomRevisionInput,
  UpdateMomDocumentInput,
  UpdateMomTemplateInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  archiveMomDocument,
  createMomDocument,
  createMomTemplate,
  createMomTemplateVersion,
  duplicateMomTemplate,
  getMomStats,
  publishMomTemplate,
  deleteMomDocument,
  deleteMomTemplate,
  finalizeMomDocument,
  finalizeMomRevision,
  getMomDocument,
  getMomTemplate,
  listMomDocuments,
  listMomDocumentsByProject,
  listMomTemplates,
  restoreMomDocument,
  startMomRevision,
  updateMomDocument,
  updateMomTemplate,
} from "./api";

const DOCUMENTS_KEY = "mom-documents";
const TEMPLATES_KEY = "mom-templates";

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useMomDocuments(query: QueryMomDocumentsInput = {}) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DOCUMENTS_KEY, "list", query),
    queryFn: () => listMomDocuments(query),
    enabled: orgId > 0,
  });
}

export function useMomStats() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DOCUMENTS_KEY, "stats"),
    queryFn: () => getMomStats(),
    enabled: orgId > 0,
  });
}

export function useMomDocumentsByProject(projectId: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DOCUMENTS_KEY, "by-project", projectId),
    queryFn: () => listMomDocumentsByProject(projectId),
    enabled: orgId > 0 && Number.isInteger(projectId) && projectId > 0,
  });
}

export function useMomDocument(id: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, DOCUMENTS_KEY, "detail", id),
    queryFn: () => getMomDocument(id),
    enabled: orgId > 0 && Number.isInteger(id) && id > 0,
  });
}

export function useCreateMomDocument() {
  return useOrgScopedMutation(
    [DOCUMENTS_KEY],
    (input: CreateMomDocumentInput) => createMomDocument(input),
  );
}

export function useUpdateMomDocument() {
  return useOrgScopedMutation(
    [DOCUMENTS_KEY],
    ({ id, input }: { id: number; input: UpdateMomDocumentInput }) =>
      updateMomDocument(id, input),
  );
}

export function useFinalizeMomDocument() {
  return useOrgScopedMutation([DOCUMENTS_KEY], (id: number) =>
    finalizeMomDocument(id),
  );
}

export function useStartMomRevision() {
  return useOrgScopedMutation(
    [DOCUMENTS_KEY],
    ({ id, input }: { id: number; input: StartMomRevisionInput }) =>
      startMomRevision(id, input),
  );
}

export function useFinalizeMomRevision() {
  return useOrgScopedMutation([DOCUMENTS_KEY], (id: number) =>
    finalizeMomRevision(id),
  );
}

export function useArchiveMomDocument() {
  return useOrgScopedMutation([DOCUMENTS_KEY], (id: number) =>
    archiveMomDocument(id),
  );
}

export function useRestoreMomDocument() {
  return useOrgScopedMutation([DOCUMENTS_KEY], (id: number) =>
    restoreMomDocument(id),
  );
}

export function useDeleteMomDocument() {
  return useOrgScopedMutation([DOCUMENTS_KEY], (id: number) =>
    deleteMomDocument(id),
  );
}

export function useMomTemplates() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, TEMPLATES_KEY, "list"),
    queryFn: () => listMomTemplates(),
    enabled: orgId > 0,
  });
}

export function useMomTemplate(id: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, TEMPLATES_KEY, "detail", id),
    queryFn: () => getMomTemplate(id),
    enabled: orgId > 0 && Number.isInteger(id) && id > 0,
  });
}

export function useCreateMomTemplate() {
  return useOrgScopedMutation(
    [TEMPLATES_KEY],
    (input: CreateMomTemplateInput) => createMomTemplate(input),
  );
}

export function useUpdateMomTemplate() {
  return useOrgScopedMutation(
    [TEMPLATES_KEY],
    ({ id, input }: { id: number; input: UpdateMomTemplateInput }) =>
      updateMomTemplate(id, input),
  );
}

export function useDeleteMomTemplate() {
  return useOrgScopedMutation([TEMPLATES_KEY], (id: number) =>
    deleteMomTemplate(id),
  );
}

export function usePublishMomTemplate() {
  return useOrgScopedMutation([TEMPLATES_KEY], (id: number) =>
    publishMomTemplate(id),
  );
}

export function useDuplicateMomTemplate() {
  return useOrgScopedMutation([TEMPLATES_KEY], (id: number) =>
    duplicateMomTemplate(id),
  );
}

export function useCreateMomTemplateVersion() {
  return useOrgScopedMutation([TEMPLATES_KEY], (id: number) =>
    createMomTemplateVersion(id),
  );
}
