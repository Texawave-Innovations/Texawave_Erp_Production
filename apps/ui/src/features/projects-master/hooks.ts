"use client";

import type {
  CreateProjectInput,
  QueryProjectsInput,
  UpdateProjectCodeMasterInput,
  UpdateProjectInput,
  UpdateTaskRunningNumberMasterInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createProject,
  deleteProject,
  getProjectCodeMaster,
  getTaskRunningNumberMaster,
  listProjects,
  updateProject,
  updateProjectCodeMaster,
  updateTaskRunningNumberMaster,
} from "./api";

const KEY = "projects-master-projects";
const CODE_MASTER_KEY = "projects-master-code-master";
const TASK_NUMBER_KEY = "projects-master-task-running-number-master";

function projectsKey(organizationId: number, query: QueryProjectsInput) {
  return orgScopedKey(organizationId, KEY, query);
}

export function useProjects(query: QueryProjectsInput = {}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: projectsKey(organizationId ?? 0, query),
    queryFn: () => listProjects(query),
    enabled: Boolean(organizationId),
  });
}

export function useCreateProject() {
  return useOrgScopedMutation([KEY], (input: CreateProjectInput) =>
    createProject(input),
  );
}

export function useUpdateProject() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, input }: { id: number; input: UpdateProjectInput }) =>
      updateProject(id, input),
  );
}

export function useDeleteProject() {
  return useOrgScopedMutation([KEY], (id: number) => deleteProject(id));
}

export function useProjectCodeMaster() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, CODE_MASTER_KEY),
    queryFn: () => getProjectCodeMaster(),
    enabled: Boolean(organizationId),
  });
}

export function useUpdateProjectCodeMaster() {
  return useOrgScopedMutation(
    [CODE_MASTER_KEY],
    (input: UpdateProjectCodeMasterInput) => updateProjectCodeMaster(input),
  );
}

export function useTaskRunningNumberMaster() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, TASK_NUMBER_KEY),
    queryFn: () => getTaskRunningNumberMaster(),
    enabled: Boolean(organizationId),
  });
}

export function useUpdateTaskRunningNumberMaster() {
  return useOrgScopedMutation(
    [TASK_NUMBER_KEY],
    (input: UpdateTaskRunningNumberMasterInput) =>
      updateTaskRunningNumberMaster(input),
  );
}
