import type { EffectivePreferences } from "@texawave-erp/core";
import { apiClient, withAuthRetry } from "@/lib/api-client";

export interface UserPreferencesDto {
  theme?: "light" | "dark" | "system" | null;
  density?: "compact" | "comfortable" | "spacious" | null;
  locale?: string | null;
  timezone?: string | null;
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | null;
  timeFormat?: "12h" | "24h" | null;
  displayCurrency?: string | null;
  customFields?: Record<string, unknown>;
}

export interface OrganizationSettingsDto {
  id?: number;
  organizationId?: number;
  theme: "light" | "dark" | "system";
  density: "compact" | "comfortable" | "spacious";
  country: string;
  locale: string;
  timezone: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  timeFormat: "12h" | "24h";
  baseCurrency: string;
  currencySymbolPosition: "before" | "after";
  numberFormat: "indian" | "international";
  fiscalYearStartMonth: number;
  customFields?: Record<string, unknown>;
}

export interface UserPreferencesResponse {
  preferences: UserPreferencesDto | null;
  effective: EffectivePreferences;
  organizationDefaults: OrganizationSettingsDto;
}

export interface ExchangeRateItem {
  id: number;
  organizationId: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  source: string;
  isHistorical: boolean;
  createdAt: string;
}

export interface CreateExchangeRateInput {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  source?: string;
}

export interface ConvertCurrencyResult {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  convertedAmount: number;
  effectiveDate: string;
  method: "identity" | "direct" | "inverse" | "triangulation";
  viaCurrency?: string;
  source?: string;
}

export async function getUserPreferences(): Promise<UserPreferencesResponse> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<UserPreferencesResponse>("/settings/preferences"),
  );
  return data;
}

export async function updateUserPreferences(
  input: UserPreferencesDto,
): Promise<UserPreferencesResponse> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<UserPreferencesResponse>("/settings/preferences", input),
  );
  return data;
}

export async function resetUserPreferences(): Promise<UserPreferencesResponse> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<UserPreferencesResponse>("/settings/preferences/reset", {}),
  );
  return data;
}

export async function getOrganizationSettings(): Promise<OrganizationSettingsDto> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<OrganizationSettingsDto>("/settings/organization"),
  );
  return data;
}

export async function updateOrganizationSettings(
  input: Partial<OrganizationSettingsDto>,
): Promise<OrganizationSettingsDto> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<OrganizationSettingsDto>("/settings/organization", input),
  );
  return data;
}

export async function listExchangeRates(query?: {
  page?: number;
  limit?: number;
  fromCurrency?: string;
  toCurrency?: string;
  effectiveDate?: string;
}) {
  const options = query ? { query } : undefined;
  const response = await withAuthRetry(() =>
    apiClient.get<ExchangeRateItem[]>("/settings/exchange-rates", options),
  );
  return response;
}

export async function upsertExchangeRate(
  input: CreateExchangeRateInput,
): Promise<ExchangeRateItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ExchangeRateItem>("/settings/exchange-rates", input),
  );
  return data;
}

export async function convertCurrency(params: {
  amount: number;
  from: string;
  to: string;
  date?: string;
}): Promise<ConvertCurrencyResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<ConvertCurrencyResult>("/settings/exchange-rates/convert", {
      query: params,
    }),
  );
  return data;
}
