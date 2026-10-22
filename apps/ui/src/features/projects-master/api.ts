import type {
  CreateProjectInput,
  PaginatedEnvelope,
  Project,
  ProjectCodeMaster,
  QueryProjectsInput,
  TaskRunningNumberMaster,
  UpdateProjectCodeMasterInput,
  UpdateProjectInput,
  UpdateTaskRunningNumberMasterInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * Thin wrappers around the shared `apiClient` — mirrors
 * apps/api/src/modules/projects-master/. One function per endpoint
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard").
 */
const BASE = "/projects-master/projects";
const CODE_MASTER_BASE = "/projects-master/code-master";
const TASK_NUMBER_BASE = "/projects-master/task-running-number-master";

export function listProjects(
  query: QueryProjectsInput = {},
): Promise<PaginatedEnvelope<Project>> {
  return withAuthRetry(() =>
    apiClient.get<Project[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<Project>>;
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Project>(`${BASE}/${id}`),
  );
  return data;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Project>(BASE, input),
  );
  return data;
}

export async function updateProject(
  id: number,
  input: UpdateProjectInput,
): Promise<Project> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Project>(`${BASE}/${id}`, input),
  );
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`${BASE}/${id}`));
}

export async function getProjectCodeMaster(): Promise<ProjectCodeMaster> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ProjectCodeMaster>(CODE_MASTER_BASE),
  );
  return data;
}

export async function updateProjectCodeMaster(
  input: UpdateProjectCodeMasterInput,
): Promise<ProjectCodeMaster> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<ProjectCodeMaster>(CODE_MASTER_BASE, input),
  );
  return data;
}

export async function getTaskRunningNumberMaster(): Promise<TaskRunningNumberMaster> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<TaskRunningNumberMaster>(TASK_NUMBER_BASE),
  );
  return data;
}

export async function updateTaskRunningNumberMaster(
  input: UpdateTaskRunningNumberMasterInput,
): Promise<TaskRunningNumberMaster> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<TaskRunningNumberMaster>(TASK_NUMBER_BASE, input),
  );
  return data;
}
