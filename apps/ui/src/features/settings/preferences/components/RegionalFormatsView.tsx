"use client";

import {
  formatCurrency,
  type DateFormat,
  type NumberFormatStyle,
  type TimeFormat,
} from "@texawave-erp/core";
import { Calculator, Check, Globe, Loader2, Plus, Save } from "lucide-react";
import React, { useState } from "react";
import {
  useConvertCurrency,
  useExchangeRates,
  useOrganizationSettings,
  useUpdateOrganizationSettings,
  useUpsertExchangeRate,
} from "../hooks";

const COMMON_TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +05:30)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST +04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +08:00)" },
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April (Standard for India / UK)" },
  { value: 7, label: "July (Standard for Australia)" },
  { value: 10, label: "October (Standard for US Federal)" },
];

export function RegionalFormatsView() {
  const { data: orgSettings, isLoading: orgLoading } =
    useOrganizationSettings();
  const updateOrgMutation = useUpdateOrganizationSettings();
  const { data: exchangeRatesData, isLoading: ratesLoading } =
    useExchangeRates();
  const upsertRateMutation = useUpsertExchangeRate();

  // Form states for Organization Settings
  const [country, setCountry] = useState("IN");
  const [locale, setLocale] = useState("en-IN");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [currencySymbolPosition, setCurrencySymbolPosition] = useState<
    "before" | "after"
  >("before");
  const [numberFormat, setNumberFormat] = useState<NumberFormatStyle>("indian");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(4);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New exchange rate form state
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("INR");
  const [rateValue, setRateValue] = useState("83.25");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const rateSource = "manual";
  const [showAddRate, setShowAddRate] = useState(false);

  // Currency Converter state
  const [calcAmount, setCalcAmount] = useState(100);
  const [calcFrom, setCalcFrom] = useState("USD");
  const [calcTo, setCalcTo] = useState("INR");

  const { data: convResult, isLoading: convLoading } = useConvertCurrency({
    amount: calcAmount,
    from: calcFrom,
    to: calcTo,
  });

  const [prevOrgSettings, setPrevOrgSettings] = useState(orgSettings);

  if (orgSettings && orgSettings !== prevOrgSettings) {
    setPrevOrgSettings(orgSettings);
    setCountry(orgSettings.country);
    setLocale(orgSettings.locale);
    setTimezone(orgSettings.timezone);
    setDateFormat(orgSettings.dateFormat);
    setTimeFormat(orgSettings.timeFormat);
    setBaseCurrency(orgSettings.baseCurrency);
    setCurrencySymbolPosition(orgSettings.currencySymbolPosition);
    setNumberFormat(orgSettings.numberFormat);
    setFiscalYearStartMonth(orgSettings.fiscalYearStartMonth);
  }

  const handleSaveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    await updateOrgMutation.mutateAsync({
      country,
      locale,
      timezone,
      dateFormat,
      timeFormat,
      baseCurrency,
      currencySymbolPosition,
      numberFormat,
      fiscalYearStartMonth,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertRateMutation.mutateAsync({
      fromCurrency,
      toCurrency,
      rate: parseFloat(rateValue),
      effectiveDate,
      source: rateSource,
    });
    setShowAddRate(false);
  };

  if (orgLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const exchangeRates = exchangeRatesData?.data ?? [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5 dark:border-[#1C2029]">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Settings › System › Regional Formats & Currency
        </div>
        <div className="mt-1">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Regional Formats & Currency Architecture
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Configure system-wide regional conventions, organization base
            currency, number grouping style, and exchange rate matrices.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Organization Regional Defaults */}
        <div className="space-y-6 lg:col-span-2">
          <form onSubmit={handleSaveOrgSettings} className="space-y-6">
            <div
              id="locale"
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1C2029] dark:bg-[#0D1117] scroll-mt-24"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#1C2029]">
                <Globe className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Organization Regional Conventions
                </h2>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Base Country Code
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    ISO-3166 alpha-2 (e.g. IN, US)
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Default Locale
                  </label>
                  <input
                    type="text"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    e.g. en-IN, en-US, en-GB
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Organization Primary Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  id="formats"
                  className="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2 scroll-mt-24 pt-2 border-t border-slate-100 dark:border-[#1C2029]"
                >
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Default Date Format
                    </label>
                    <select
                      value={dateFormat}
                      onChange={(e) =>
                        setDateFormat(e.target.value as DateFormat)
                      }
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                    >
                      <option value="DD/MM/YYYY">
                        DD/MM/YYYY (e.g. 16/10/2026)
                      </option>
                      <option value="MM/DD/YYYY">
                        MM/DD/YYYY (e.g. 10/16/2026)
                      </option>
                      <option value="YYYY-MM-DD">
                        YYYY-MM-DD (e.g. 2026-10-16)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Default Time Format
                    </label>
                    <select
                      value={timeFormat}
                      onChange={(e) =>
                        setTimeFormat(e.target.value as TimeFormat)
                      }
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                    >
                      <option value="12h">12-hour clock (1:45 PM)</option>
                      <option value="24h">24-hour clock (13:45)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Number Grouping System
                    </label>
                    <select
                      value={numberFormat}
                      onChange={(e) =>
                        setNumberFormat(e.target.value as NumberFormatStyle)
                      }
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                    >
                      <option value="indian">
                        Indian (Lakhs & Crores: 1,23,45,678)
                      </option>
                      <option value="international">
                        International (Millions & Billions: 12,345,678)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Fiscal Year Start Month
                    </label>
                    <select
                      value={fiscalYearStartMonth}
                      onChange={(e) =>
                        setFiscalYearStartMonth(Number(e.target.value))
                      }
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                    >
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Base Currency Architecture */}
            <div
              id="currency"
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1C2029] dark:bg-[#0D1117] scroll-mt-24"
            >
              <div className="border-b border-slate-100 pb-3 dark:border-[#1C2029]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Base Accounting Currency
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Defines the permanent general ledger and statutory reporting
                  currency.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Base Currency Code
                  </label>
                  <input
                    type="text"
                    value={baseCurrency}
                    onChange={(e) =>
                      setBaseCurrency(e.target.value.toUpperCase())
                    }
                    maxLength={3}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-medium shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Default: INR (Indian Rupee)
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Currency Symbol Placement
                  </label>
                  <select
                    value={currencySymbolPosition}
                    onChange={(e) =>
                      setCurrencySymbolPosition(
                        e.target.value as "before" | "after",
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                  >
                    <option value="before">
                      Before Amount (e.g. ₹ 50,000)
                    </option>
                    <option value="after">After Amount (e.g. 50,000 €)</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <strong>Accounting Invariant:</strong> In accordance with
                TexaWave ERP currency architecture, all transaction records,
                journal vouchers, and payroll entries are stored immutably in
                the transaction and base currency amounts. Display currency
                selections never alter stored financial rows.
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1C2029] dark:bg-[#0D1117]">
              <div>
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" />
                    Organization regional settings updated successfully!
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={updateOrgMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-linear-135 from-blue-600 via-brand-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:opacity-50"
              >
                {updateOrgMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Organization Settings
              </button>
            </div>
          </form>

          {/* Exchange Rates Table */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1C2029] dark:bg-[#0D1117]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#1C2029]">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Exchange Rates Matrix
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Maintains currency conversion rates with effective dates for
                  multi-currency operations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRate(!showAddRate)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:hover:bg-[#1C2029]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Rate
              </button>
            </div>

            {showAddRate && (
              <form
                onSubmit={handleAddRate}
                className="my-4 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-[#1C2029] dark:bg-[#121620]"
              >
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  New Exchange Rate Entry
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      From
                    </label>
                    <input
                      type="text"
                      value={fromCurrency}
                      onChange={(e) =>
                        setFromCurrency(e.target.value.toUpperCase())
                      }
                      maxLength={3}
                      className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      To
                    </label>
                    <input
                      type="text"
                      value={toCurrency}
                      onChange={(e) =>
                        setToCurrency(e.target.value.toUpperCase())
                      }
                      maxLength={3}
                      className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Rate
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={rateValue}
                      onChange={(e) => setRateValue(e.target.value)}
                      className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Effective Date
                    </label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC]"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      disabled={upsertRateMutation.isPending}
                      className="rounded-lg bg-linear-135 from-blue-600 via-brand-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-95"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddRate(false)}
                      className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-[#1C2029]">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-[#1C2029]">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#121620] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Currency Pair</th>
                    <th className="px-4 py-2 font-medium">Exchange Rate</th>
                    <th className="px-4 py-2 font-medium">Effective Date</th>
                    <th className="px-4 py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-[#1C2029] dark:bg-[#0D1117]">
                  {ratesLoading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-4 text-center text-slate-500"
                      >
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      </td>
                    </tr>
                  ) : exchangeRates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-4 text-center text-slate-400"
                      >
                        No custom exchange rates configured. Identity rates
                        apply.
                      </td>
                    </tr>
                  ) : (
                    exchangeRates.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 dark:hover:bg-[#161B26]"
                      >
                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                          {r.fromCurrency} / {r.toCurrency}
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-800 dark:text-slate-200">
                          {r.rate}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                          {r.effectiveDate}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase dark:bg-[#161B26] dark:text-slate-300">
                            {r.source}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Currency Converter Widget */}
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1C2029] dark:bg-[#0D1117]">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#1C2029]">
              <Calculator className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Currency Conversion Test
              </h3>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300">
                  Amount
                </label>
                <input
                  type="number"
                  value={calcAmount}
                  onChange={(e) =>
                    setCalcAmount(parseFloat(e.target.value) || 0)
                  }
                  className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">
                    From
                  </label>
                  <input
                    type="text"
                    value={calcFrom}
                    onChange={(e) => setCalcFrom(e.target.value.toUpperCase())}
                    maxLength={3}
                    className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">
                    To
                  </label>
                  <input
                    type="text"
                    value={calcTo}
                    onChange={(e) => setCalcTo(e.target.value.toUpperCase())}
                    maxLength={3}
                    className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#1C2029] dark:bg-[#121620]">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Converted Output:
                </span>
                {convLoading ? (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> Calculating
                    conversion...
                  </div>
                ) : convResult ? (
                  <div className="mt-1">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(convResult.convertedAmount, {
                        currency: convResult.toCurrency,
                        position: currencySymbolPosition,
                        style: numberFormat,
                      })}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span>Rate: {convResult.rate}</span>
                      <span>•</span>
                      <span className="font-medium text-cyan-600 dark:text-cyan-400 uppercase">
                        Method: {convResult.method}
                      </span>
                      {convResult.viaCurrency && (
                        <span>(via {convResult.viaCurrency})</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-400">
                    Enter valid currencies to compute conversion.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
