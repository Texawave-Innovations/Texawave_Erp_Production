// Wire types for Users module

export interface UserRoleSummary {
  id: number;
  name: string;
  isActive: boolean;
}

export interface UserTeamSummary {
  id: number;
  name: string;
  code: string;
  isLead: boolean;
}

export interface User {
  id: number;
  organizationId: number;
  email: string;
  fullName: string;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  roles: UserRoleSummary[];
  teams: UserTeamSummary[];
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  password: string;
  mustChangePassword?: boolean;
  roleIds?: number[];
  teamIds?: number[];
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string;
  isActive?: boolean;
}

export interface QueryUsersInput {
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
}

export interface AssignUserRolesInput {
  roleIds: number[];
}

export interface TeamAssignmentItem {
  teamId: number;
  isLead?: boolean;
}

export interface AssignUserTeamsInput {
  teamIds?: number[];
  teams?: TeamAssignmentItem[];
}
