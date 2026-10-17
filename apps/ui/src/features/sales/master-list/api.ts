import { apiClient, withAuthRetry } from "@/lib/api-client";
import type {
  CodeFormat,
  CodeType,
  CompanyProfile,
  CompanyProfileBody,
  FieldLayout,
  DocumentCodeType,
  MasterField,
  MasterOption,
  OptionBody,
  RunningNumber,
} from "./types";

export const MASTER = "/sales/master";
export const COMPANY_LOGO = `${MASTER}/company-profile/logo`;
export const optionImagePath = (id: number) =>
  `${MASTER}/document-fields/${id}/image`;

// --- code formats and running numbers --------------------------------------

export async function listCodeFormats(): Promise<CodeFormat[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CodeFormat[]>(`${MASTER}/code-formats`),
  );
  return data;
}

export async function updateCodeFormat(
  codeType: CodeType,
  body: { prefix: string; padding: number },
): Promise<CodeFormat> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<CodeFormat>(`${MASTER}/code-formats/${codeType}`, body),
  );
  return data;
}

export async function listRunningNumbers(): Promise<RunningNumber[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<RunningNumber[]>(`${MASTER}/running-numbers`),
  );
  return data;
}

export async function setRunningNumber(
  codeType: DocumentCodeType,
  body: { lastNumber: number; fiscalYear: string },
): Promise<RunningNumber> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<RunningNumber>(
      `${MASTER}/running-numbers/${codeType}`,
      body,
    ),
  );
  return data;
}

// --- company details --------------------------------------------------------

export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CompanyProfile | null>(`${MASTER}/company-profile`),
  );
  return data;
}

export async function saveCompanyProfile(
  body: CompanyProfileBody,
): Promise<CompanyProfile> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<CompanyProfile>(`${MASTER}/company-profile`, body),
  );
  return data;
}

function upload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  return withAuthRetry(() =>
    apiClient.request<T>(path, { method: "PUT", formData }),
  ).then((res) => res.data);
}

export function uploadCompanyLogo(file: File): Promise<CompanyProfile> {
  return upload<CompanyProfile>(COMPANY_LOGO, file);
}

export async function removeCompanyLogo(): Promise<CompanyProfile> {
  const { data } = await withAuthRetry(() =>
    apiClient.delete<CompanyProfile>(COMPANY_LOGO),
  );
  return data;
}

// --- document fields --------------------------------------------------------

export async function getFieldLayout(): Promise<FieldLayout[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FieldLayout[]>(`${MASTER}/document-fields/layout`),
  );
  return data;
}

export async function createOption(
  body: OptionBody & { field: MasterField },
): Promise<MasterOption> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MasterOption>(`${MASTER}/document-fields`, body),
  );
  return data;
}

export async function updateOption(
  id: number,
  body: OptionBody,
): Promise<MasterOption> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<MasterOption>(`${MASTER}/document-fields/${id}`, body),
  );
  return data;
}

export async function deleteOption(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete(`${MASTER}/document-fields/${id}`),
  );
}

export function uploadOptionImage(id: number, file: File) {
  return upload<MasterOption>(optionImagePath(id), file);
}
