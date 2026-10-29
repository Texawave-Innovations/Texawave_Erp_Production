"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  defaultFormatter,
  orgScopedKey,
  RegionalFormatter,
} from "@texawave-erp/core";
import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import {
  convertCurrency,
  getOrganizationSettings,
  getUserPreferences,
  listExchangeRates,
  resetUserPreferences,
  updateOrganizationSettings,
  updateUserPreferences,
  upsertExchangeRate,
  type CreateExchangeRateInput,
  type OrganizationSettingsDto,
  type UserPreferencesDto,
} from "./api";
import { applyDensityToDom, applyThemeToDom } from "./theme-manager";

export function preferencesKey(organizationId: number) {
  return orgScopedKey(organizationId, "settings-preferences");
}

export function orgSettingsKey(organizationId: number) {
  return orgScopedKey(organizationId, "settings-organization");
}

export function exchangeRatesKey(
  organizationId: number,
  query?: Record<string, unknown>,
) {
  return orgScopedKey(organizationId, "settings-exchange-rates", query ?? {});
}

export function useUserPreferences() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: preferencesKey(organizationId ?? 0),
    queryFn: () => getUserPreferences(),
    enabled: Boolean(organizationId),
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: (input: UserPreferencesDto) => updateUserPreferences(input),
    onSuccess: (data) => {
      queryClient.setQueryData(preferencesKey(organizationId ?? 0), data);
      if (data?.effective) {
        applyThemeToDom(data.effective.theme as "light" | "dark" | "system");
        applyDensityToDom(
          data.effective.density as "compact" | "comfortable" | "spacious",
        );
      }
    },
  });
}

export function useResetUserPreferences() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: () => resetUserPreferences(),
    onSuccess: (data) => {
      queryClient.setQueryData(preferencesKey(organizationId ?? 0), data);
      if (data?.effective) {
        applyThemeToDom(data.effective.theme as "light" | "dark" | "system");
        applyDensityToDom(
          data.effective.density as "compact" | "comfortable" | "spacious",
        );
      }
    },
  });
}

export function useOrganizationSettings() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgSettingsKey(organizationId ?? 0),
    queryFn: () => getOrganizationSettings(),
    enabled: Boolean(organizationId),
  });
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: (input: Partial<OrganizationSettingsDto>) =>
      updateOrganizationSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orgSettingsKey(organizationId ?? 0),
      });
      queryClient.invalidateQueries({
        queryKey: preferencesKey(organizationId ?? 0),
      });
    },
  });
}

export function useExchangeRates(query?: {
  page?: number;
  limit?: number;
  fromCurrency?: string;
  toCurrency?: string;
  effectiveDate?: string;
}) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: exchangeRatesKey(organizationId ?? 0, query),
    queryFn: () => listExchangeRates(query),
    enabled: Boolean(organizationId),
  });
}

export function useUpsertExchangeRate() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  return useMutation({
    mutationFn: (input: CreateExchangeRateInput) => upsertExchangeRate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orgScopedKey(organizationId ?? 0, "settings-exchange-rates"),
      });
    },
  });
}

export function useConvertCurrency(
  params: {
    amount: number;
    from: string;
    to: string;
    date?: string;
  },
  options?: { enabled?: boolean },
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "convert-currency", params),
    queryFn: () => convertCurrency(params),
    enabled:
      Boolean(organizationId) &&
      Boolean(params.from) &&
      Boolean(params.to) &&
      (options?.enabled ?? true),
  });
}

/**
 * Universal formatting hook for TexaWave ERP components.
 * Consumes the active user preferences (with fallback to organization defaults)
 * and returns localized, reactive formatters with real multi-currency conversion.
 */
export function useRegionalFormatter() {
  const { data: prefResponse, isLoading: prefLoading } = useUserPreferences();
  const { data: exchangeRatesData, isLoading: ratesLoading } = useExchangeRates(
    { limit: 100 },
  );

  const effective = prefResponse?.effective;
  const exchangeRates = exchangeRatesData?.data;

  const formatter = useMemo(() => {
    if (!effective) {
      return exchangeRates
        ? new RegionalFormatter({ exchangeRates })
        : defaultFormatter;
    }
    return new RegionalFormatter({
      ...effective,
      exchangeRates,
    });
  }, [effective, exchangeRates]);

  return {
    formatter,
    formatDate: formatter.formatDate,
    formatTime: formatter.formatTime,
    formatDateTime: formatter.formatDateTime,
    formatNumber: formatter.formatNumber,
    formatCurrency: formatter.formatCurrency,
    convert: formatter.convert.bind(formatter),
    convertCurrency: formatter.convert.bind(formatter),
    getExchangeRate: formatter.getExchangeRate.bind(formatter),
    effective: prefResponse?.effective,
    exchangeRates,
    isLoading: prefLoading || ratesLoading,
  };
}
