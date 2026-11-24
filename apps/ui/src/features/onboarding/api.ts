import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import type { NewHireFormValues } from "@texawave-erp/core";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

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

/** One server call (`POST /hr/employees/new-hire`): the API creates the login
 * (Employee role, plus Team Lead when asked, forced password change) and the
 * employee record linked to it in ONE transaction — either both exist or
 * neither does. Needs hr.employee.write + hr.employee_account.write; no
 * Settings → Roles / Users access. */
export async function createNewHire(
  values: NewHireFormValues,
): Promise<CreatedEmployee> {
  const res = await withAuthRetry(() =>
    apiClient.post<CreatedEmployee>("/hr/employees/new-hire", {
      fullName: `${values.firstName} ${values.lastName}`,
      email: values.email,
      phone: values.mobile,
      teamId: values.teamId,
      departmentId: values.departmentId,
      designationId: values.designationId,
      employmentTypeId: values.employmentTypeId,
      dateOfJoining: values.dateOfJoining,
      tempPassword: values.tempPassword,
      ...(values.additionalRole
        ? { additionalRole: values.additionalRole }
        : {}),
    }),
  );
  return res.data;
}

export interface MyEmployee {
  id: number;
  fullName: string;
  employeeCode: string;
  status?: string;
  dateOfJoining?: string;
  workEmail?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  team?: { id: number; name: string } | null;
  department?: { id: number; name: string } | null;
  designation?: { id: number; name: string } | null;
  employmentType?: { id: number; name: string } | null;
  workLocation?: { id: number; name: string } | null;
  reportsTo?: { id: number; employeeCode: string; fullName: string } | null;
  onboardingStatus: string;
  /** HR's review of the submitted profile (see OnboardingWizard's banner). */
  onboardingReviewStatus?: string;
  /** On CHANGES_REQUESTED: what HR asked the employee to correct. */
  onboardingReviewNote?: string | null;
  // The rest of GET /employee/profile (EmployeeDetail in apps/api
  // .../hr/employees/employee-mappers.ts), read by the portal's My Profile.
  referredBy?: string | null;
  workDomain?: string | null;
  probationEndDate?: string | null;
  confirmationDate?: string | null;
}

export interface SubmitResult {
  missing: string[];
}

export function getMyEmployee(): Promise<MyEmployee> {
  return withAuthRetry(() =>
    apiClient.get<MyEmployee>("/employee/profile"),
  ).then((res) => res.data);
}

/** The self-editable subset (PATCH /employee/profile — apps/api
 * .../employee-self-service/profile/dto/self-profile-update.dto.ts). Only the
 * keys sent change; the API rejects any other field with a 400. */
export interface SelfProfileAddress {
  addressLine: string;
  areaLocality?: string;
  district: string;
  city: string;
  state: string;
  pincode: string;
}

export interface SelfProfileUpdate {
  fullName?: string;
  phone?: string;
  referredBy?: string | null;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string | null;
  bloodGroup?: string | null;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  permanentAddress?: SelfProfileAddress;
  /** null = same as permanent. */
  presentAddress?: SelfProfileAddress | null;
}

export function updateMyProfile(input: SelfProfileUpdate): Promise<MyEmployee> {
  return withAuthRetry(() =>
    apiClient.patch<MyEmployee>("/employee/profile", input),
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

export function getMyBank(): Promise<Record<string, unknown> | null> {
  return withAuthRetry(() =>
    apiClient.get<Record<string, unknown> | null>(
      "/employee/profile/bank-details",
    ),
  ).then((res) => res.data);
}

export function saveBank(input: object) {
  return withAuthRetry(() =>
    apiClient.put("/employee/profile/bank-details", input),
  );
}

export function getMyGovernmentIds(): Promise<Record<string, unknown> | null> {
  return withAuthRetry(() =>
    apiClient.get<Record<string, unknown> | null>(
      "/employee/profile/government-ids",
    ),
  ).then((res) => res.data);
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

/** apiClient only parses JSON, so the binary download goes through fetch
 * directly, reusing the same bearer token and base URL — same pattern as
 * apps/ui/src/features/hr/employee-documents/api.ts's downloadEmployeeDocument. */
export async function downloadMyDocument(
  documentType: string,
  fileName: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(
    `${baseUrl}/employee/profile/documents/${documentType}/file`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** The raw file of one of my documents (authenticated fetch), for an
 * in-page preview or "View" in a new tab. */
export async function fetchMyDocumentBlob(documentType: string): Promise<Blob> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(
    `${baseUrl}/employee/profile/documents/${documentType}/file`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }
  return res.blob();
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
