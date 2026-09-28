import type {
  AssignUserRolesInput,
  AssignUserTeamsInput,
  CreateUserInput,
  PaginatedEnvelope,
  QueryUsersInput,
  UpdateUserInput,
  User,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

export function listUsers(
  query: QueryUsersInput = {},
): Promise<PaginatedEnvelope<User>> {
  return withAuthRetry(() =>
    apiClient.get<User[]>("/users", { query }),
  ) as Promise<PaginatedEnvelope<User>>;
}

export async function getUser(id: number): Promise<User> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<User>(`/users/${id}`),
  );
  return data;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<User>("/users", input),
  );
  return data;
}

export async function updateUser(
  id: number,
  input: UpdateUserInput,
): Promise<User> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<User>(`/users/${id}`, input),
  );
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/users/${id}`));
}

export async function assignUserRoles(
  id: number,
  input: AssignUserRolesInput,
): Promise<User> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<User>(`/users/${id}/roles`, input),
  );
  return data;
}

export async function assignUserTeams(
  id: number,
  input: AssignUserTeamsInput,
): Promise<User> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<User>(`/users/${id}/teams`, input),
  );
  return data;
}
