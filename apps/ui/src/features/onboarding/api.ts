import type {
  CreateUserInput,
  PaginatedEnvelope,
  User,
} from "@texawave-erp/api-types";
import type { NewHireFormValues } from "@texawave-erp/core";
import { apiClient, withAuthRetry } from "@/lib/api-client";

export interface Option {
  id: number;
  name: string;
}

export interface TeamOption extends Option {
  code: string;
}

export interface CreatedEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  userId: number | null;
  onboardingStatus: string;
}

/** Thrown when the login was created but the employee record was not. The
 * login exists, so the caller must surface `userId` for cleanup instead of
 * letting HR retry the whole form (which would hit "email already in use"). */
export class PartialNewHireError extends Error {
  constructor(
    message: string,
    readonly userId: number,
  ) {
    super(message);
  }
}

export function listTeams(): Promise<TeamOption[]> {
  return withAuthRetry(() => apiClient.get<TeamOption[]>("/hr/teams")).then(
    (res) => res.data,
  );
}

function listOptions(path: string): Promise<Option[]> {
  return withAuthRetry(() =>
    apiClient.get<Option[]>(path, { query: { limit: 100 } }),
  ).then((res) => (res as unknown as PaginatedEnvelope<Option>).data);
}

export const listDesignations = () => listOptions("/master-data/designations");
export const listEmploymentTypes = () =>
  listOptions("/master-data/employment-types");
export const listDepartments = () => listOptions("/departments");
export const listRoles = () => listOptions("/settings/roles");

/** Two composed calls — see Docs/ARCHITECTURE.md §7a. Step 1 creates the
 * login with a forced password change; step 2 links the new employee to it. */
export async function createNewHire(
  values: NewHireFormValues,
): Promise<CreatedEmployee> {
  const userInput: CreateUserInput = {
    email: values.email,
    fullName: `${values.firstName} ${values.lastName}`,
    password: values.tempPassword,
    mustChangePassword: true,
    roleIds: [values.roleId],
  };
  const user = await withAuthRetry(() =>
    apiClient.post<User>("/users", userInput),
  ).then((res) => res.data);

  try {
    const res = await withAuthRetry(() =>
      apiClient.post<CreatedEmployee>("/hr/employees", {
        fullName: `${values.firstName} ${values.lastName}`,
        workEmail: values.email,
        phone: values.mobile,
        teamId: values.teamId,
        departmentId: values.departmentId,
        designationId: values.designationId,
        employmentTypeId: values.employmentTypeId,
        dateOfJoining: values.dateOfJoining,
        userId: user.id,
      }),
    );
    return res.data;
  } catch {
    throw new PartialNewHireError(
      "The login was created, but the employee record could not be saved.",
      user.id,
    );
  }
}

export interface MyEmployee {
  id: number;
  fullName: string;
  employeeCode: string;
  onboardingStatus: string;
}

export interface SubmitResult {
  missing: string[];
}

export function getMyEmployee(): Promise<MyEmployee> {
  return withAuthRetry(() =>
    apiClient.get<MyEmployee>("/employee/profile"),
  ).then((res) => res.data);
}

export interface EmployeeOnboardingProgress {
  employeeId: number;
  onboardingStatus: string;
  missing: string[];
}

/** HR's read-only progress view; the server scopes the id to the caller's teams. */
export function getEmployeeOnboarding(
  employeeId: number,
): Promise<EmployeeOnboardingProgress> {
  return withAuthRetry(() =>
    apiClient.get<EmployeeOnboardingProgress>(
      `/hr/employees/${employeeId}/onboarding`,
    ),
  ).then((res) => res.data);
}

export function getMyPersonal(): Promise<Record<string, unknown> | null> {
  return withAuthRetry(() =>
    apiClient.get<Record<string, unknown> | null>(
      "/employee/profile/personal-details",
    ),
  ).then((res) => res.data);
}

export function savePersonal(input: object) {
  return withAuthRetry(() =>
    apiClient.put("/employee/profile/personal-details", input),
  );
}

export function saveAddress(type: "PERMANENT" | "PRESENT", input: object) {
  return withAuthRetry(() =>
    apiClient.put(`/employee/profile/address/${type}`, input),
  );
}

export function clearPresentAddress() {
  return withAuthRetry(() =>
    apiClient.delete("/employee/profile/address/present"),
  );
}

export function getMyAddress(
  type: "PERMANENT" | "PRESENT",
): Promise<Record<string, unknown> | null> {
  return withAuthRetry(() =>
    apiClient.get<Record<string, unknown> | null>(
      `/employee/profile/address/${type}`,
    ),
  ).then((res) => res.data);
}

export interface FamilyMemberRow {
  id: number;
  name: string;
  relation: string;
  dateOfBirth: string | null;
  contactPhone: string | null;
}

export interface ExperienceRow {
  id: number;
  employer: string;
  designation: string;
  fromDate: string;
  toDate: string | null;
  reasonForLeaving: string | null;
}

export function listFamilyMembers(): Promise<FamilyMemberRow[]> {
  return withAuthRetry(() =>
    apiClient.get<FamilyMemberRow[]>("/employee/profile/family"),
  ).then((res) => res.data);
}

export function addFamilyMember(input: object) {
  return withAuthRetry(() => apiClient.post("/employee/profile/family", input));
}

export function removeFamilyMember(id: number) {
  return withAuthRetry(() =>
    apiClient.delete(`/employee/profile/family/${id}`),
  );
}

export function listExperience(): Promise<ExperienceRow[]> {
  return withAuthRetry(() =>
    apiClient.get<ExperienceRow[]>("/employee/profile/experience"),
  ).then((res) => res.data);
}

export function addExperience(input: object) {
  return withAuthRetry(() =>
    apiClient.post("/employee/profile/experience", input),
  );
}

export function removeExperience(id: number) {
  return withAuthRetry(() =>
    apiClient.delete(`/employee/profile/experience/${id}`),
  );
}

export function saveBank(input: object) {
  return withAuthRetry(() =>
    apiClient.put("/employee/profile/bank-details", input),
  );
}

export function saveGovernmentIds(input: object) {
  return withAuthRetry(() =>
    apiClient.put("/employee/profile/government-ids", input),
  );
}

export function submitOnboarding(): Promise<SubmitResult> {
  return withAuthRetry(() =>
    apiClient.post<SubmitResult>("/employee/profile/submit"),
  ).then((res) => res.data);
}

export interface DocumentRecord {
  documentType: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
}

export function listMyDocuments(): Promise<DocumentRecord[]> {
  return withAuthRetry(() =>
    apiClient.get<DocumentRecord[]>("/employee/profile/documents"),
  ).then((res) => res.data);
}

/** Multipart upload through the shared client — see `formData` in packages/core. */
export function uploadDocument(
  documentType: string,
  file: File,
): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append("file", file);
  return withAuthRetry(() =>
    apiClient.request<DocumentRecord>(
      `/employee/profile/documents/${documentType}/file`,
      { method: "PUT", formData },
    ),
  ).then((res) => res.data);
}
