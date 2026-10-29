"use client";

import {
  type DensityPreference,
  type ThemePreference,
} from "@texawave-erp/core";
import {
  ArrowRight,
  Check,
  Globe,
  Loader2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Sun,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import {
  useResetUserPreferences,
  useUpdateUserPreferences,
  useUserPreferences,
} from "../hooks";
import {
  applyDensityToDom,
  applyThemeToDom,
  getStoredDensity,
  getStoredTheme,
} from "../theme-manager";

export function PreferencesView() {
  const { data, isLoading, isError } = useUserPreferences();
  const updateMutation = useUpdateUserPreferences();
  const resetMutation = useResetUserPreferences();

  const [themeState, setThemeState] = useState<ThemePreference | null>(null);
  const [densityState, setDensityState] = useState<DensityPreference | null>(
    null,
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [prevData, setPrevData] = useState(data);

  if (data !== prevData) {
    setPrevData(data);
    if (data?.effective) {
      setThemeState(
        (data.preferences?.theme ??
          getStoredTheme() ??
          data.effective.theme) as ThemePreference,
      );
      setDensityState(
        data.preferences?.density ??
          getStoredDensity() ??
          data.effective.density,
      );
    }
  }

  const theme =
    themeState ??
    ((data?.preferences?.theme ??
      getStoredTheme() ??
      data?.effective?.theme ??
      "system") as ThemePreference);
  const density =
    densityState ??
    ((data?.preferences?.density ??
      getStoredDensity() ??
      data?.effective?.density ??
      "comfortable") as DensityPreference);
  const setTheme = setThemeState;
  const setDensity = setDensityState;

  const handleSelectTheme = (newTheme: ThemePreference) => {
    setTheme(newTheme);
    applyThemeToDom(newTheme as "light" | "dark" | "system");
    updateMutation.mutate({ theme: newTheme });
  };

  const handleSelectDensity = (newDensity: DensityPreference) => {
    setDensity(newDensity);
    applyDensityToDom(newDensity as "compact" | "comfortable" | "spacious");
    updateMutation.mutate({ density: newDensity });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);

    // Safeguard: ensure the theme being persisted is the currently chosen theme,
    // avoiding accidental reset to light mode or stale fallback.
    const activeTheme =
      theme ??
      getStoredTheme() ??
      data?.preferences?.theme ??
      data?.effective.theme ??
      "system";
    const activeDensity =
      density ??
      getStoredDensity() ??
      data?.preferences?.density ??
      data?.effective.density ??
      "comfortable";

    const result = await updateMutation.mutateAsync({
      theme: activeTheme,
      density: activeDensity,
    });
    if (result?.effective) {
      applyDensityToDom(
        result.effective.density as "compact" | "comfortable" | "spacious",
      );
      applyThemeToDom(result.effective.theme as "light" | "dark" | "system");
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = async () => {
    if (
      confirm(
        "Reset personal theme and density preferences to organization defaults?",
      )
    ) {
      const result = await resetMutation.mutateAsync();
      if (result?.effective) {
        setTheme(result.effective.theme);
        setDensity(result.effective.density);
        applyDensityToDom(
          result.effective.density as "compact" | "comfortable" | "spacious",
        );
        applyThemeToDom(result.effective.theme as "light" | "dark" | "system");
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Failed to load preferences. Please ensure the backend is running.
      </div>
    );
  }

  const overrides = data.effective.isUserOverridden;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 dark:border-[#1C2029]">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Settings › System › Preferences
        </div>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              User Preferences
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Personalize your visual theme and global interface density across
              TexaWave ERP.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:hover:bg-[#1C2029]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Organization Defaults
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        {/* Main Settings (2 Columns) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Display & Theme Card */}
          <div
            id="theme"
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1C2029] dark:bg-[#0D1117] scroll-mt-24"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#1C2029]">
              <Palette className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Display & Appearance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure visual appearance, theme modes, and interface
                  density.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-6">
              {/* Theme Mode Section */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Theme Mode
                  </label>
                  {overrides.theme ? (
                    <span className="text-[10px] font-medium text-blue-600 dark:text-cyan-400">
                      Personal override
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      Org default: {data.organizationDefaults.theme}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {/* Light Mode Card */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={theme === "light"}
                    onClick={() => handleSelectTheme("light")}
                    className={`group relative flex flex-col items-center justify-center rounded-lg p-4 text-center transition-all ${
                      theme === "light"
                        ? "border-2 border-[#2454E8] bg-blue-50/60 dark:border-cyan-500 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-sm ring-1 ring-[#2454E8]/40 dark:ring-cyan-500/40"
                        : "border border-slate-200 bg-white hover:border-slate-300 dark:border-[#1C2029] dark:bg-[#121620] dark:hover:border-slate-600 dark:hover:bg-[#161B26] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        theme === "light"
                          ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
                          : "bg-slate-100 text-slate-500 dark:bg-[#161B26] dark:text-slate-400 group-hover:text-amber-500"
                      }`}
                    >
                      <Sun className="h-5 w-5" />
                    </div>
                    <span className="mt-2 text-xs font-semibold">Light</span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-400">
                      Bright, crisp daytime UI
                    </span>
                    {theme === "light" && (
                      <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-cyan-500 text-white">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Dark Mode Card */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={theme === "dark"}
                    onClick={() => handleSelectTheme("dark")}
                    className={`group relative flex flex-col items-center justify-center rounded-lg p-4 text-center transition-all ${
                      theme === "dark"
                        ? "border-2 border-[#2454E8] bg-blue-50/60 dark:border-cyan-500 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-sm ring-1 ring-[#2454E8]/40 dark:ring-cyan-500/40"
                        : "border border-slate-200 bg-white hover:border-slate-300 dark:border-[#1C2029] dark:bg-[#121620] dark:hover:border-slate-600 dark:hover:bg-[#161B26] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        theme === "dark"
                          ? "bg-indigo-100 text-indigo-600 dark:bg-blue-500/20 dark:text-cyan-400"
                          : "bg-slate-100 text-slate-500 dark:bg-[#161B26] dark:text-slate-400 group-hover:text-indigo-400"
                      }`}
                    >
                      <Moon className="h-5 w-5" />
                    </div>
                    <span className="mt-2 text-xs font-semibold">Dark</span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-400">
                      Deep charcoal slate theme
                    </span>
                    {theme === "dark" && (
                      <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-cyan-500 text-white">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* System Mode Card */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={theme === "system"}
                    onClick={() => handleSelectTheme("system")}
                    className={`group relative flex flex-col items-center justify-center rounded-lg p-4 text-center transition-all ${
                      theme === "system"
                        ? "border-2 border-[#2454E8] bg-blue-50/60 dark:border-cyan-500 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-sm ring-1 ring-[#2454E8]/40 dark:ring-cyan-500/40"
                        : "border border-slate-200 bg-white hover:border-slate-300 dark:border-[#1C2029] dark:bg-[#121620] dark:hover:border-slate-600 dark:hover:bg-[#161B26] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        theme === "system"
                          ? "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400"
                          : "bg-slate-100 text-slate-500 dark:bg-[#161B26] dark:text-slate-400 group-hover:text-cyan-500"
                      }`}
                    >
                      <Monitor className="h-5 w-5" />
                    </div>
                    <span className="mt-2 text-xs font-semibold">System</span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-400">
                      Matches OS preferences
                    </span>
                    {theme === "system" && (
                      <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-cyan-500 text-white">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Interface Density Section */}
              <div className="pt-4 border-t border-slate-100 dark:border-[#1C2029]">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Global UI Density
                  </label>
                  {overrides.density ? (
                    <span className="text-[10px] font-medium text-blue-600 dark:text-cyan-400">
                      Personal override
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      Org default: {data.organizationDefaults.density}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {/* Compact Density Card */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={density === "compact"}
                    onClick={() => handleSelectDensity("compact")}
                    className={`group relative flex flex-col items-center justify-center rounded-lg p-4 text-center transition-all ${
                      density === "compact"
                        ? "border-2 border-[#2454E8] bg-blue-50/60 dark:border-cyan-500 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-sm ring-1 ring-[#2454E8]/40 dark:ring-cyan-500/40"
                        : "border border-slate-200 bg-white hover:border-slate-300 dark:border-[#1C2029] dark:bg-[#121620] dark:hover:border-slate-600 dark:hover:bg-[#161B26] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-full bg-slate-100 dark:bg-[#161B26]">
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                    </div>
                    <span className="mt-2 text-xs font-semibold">Compact</span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-400">
                      Dense tables & metrics
                    </span>
                    {density === "compact" && (
                      <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-cyan-500 text-white">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Comfortable Density Card */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={density === "comfortable"}
                    onClick={() => handleSelectDensity("comfortable")}
                    className={`group relative flex flex-col items-center justify-center rounded-lg p-4 text-center transition-all ${
                      density === "comfortable"
                        ? "border-2 border-[#2454E8] bg-blue-50/60 dark:border-cyan-500 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-sm ring-1 ring-[#2454E8]/40 dark:ring-cyan-500/40"
                        : "border border-slate-200 bg-white hover:border-slate-300 dark:border-[#1C2029] dark:bg-[#121620] dark:hover:border-slate-600 dark:hover:bg-[#161B26] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-full bg-slate-100 dark:bg-[#161B26]">
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                    </div>
                    <span className="mt-2 text-xs font-semibold">
                      Comfortable
                    </span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-400">
                      Balanced spacing
                    </span>
                    {density === "comfortable" && (
                      <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-cyan-500 text-white">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Spacious Density Card */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={density === "spacious"}
                    onClick={() => handleSelectDensity("spacious")}
                    className={`group relative flex flex-col items-center justify-center rounded-lg p-4 text-center transition-all ${
                      density === "spacious"
                        ? "border-2 border-[#2454E8] bg-blue-50/60 dark:border-cyan-500 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-sm ring-1 ring-[#2454E8]/40 dark:ring-cyan-500/40"
                        : "border border-slate-200 bg-white hover:border-slate-300 dark:border-[#1C2029] dark:bg-[#121620] dark:hover:border-slate-600 dark:hover:bg-[#161B26] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full bg-slate-100 dark:bg-[#161B26]">
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                      <div className="h-1 w-5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                    </div>
                    <span className="mt-2 text-xs font-semibold">Spacious</span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-400">
                      Relaxed, touch-friendly
                    </span>
                    {density === "spacious" && (
                      <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-cyan-500 text-white">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Regional Formats Link Banner */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-xs dark:border-[#1C2029] dark:bg-[#0D1117]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-cyan-400">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Regional Formats & Currency
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Timezones, date & time formats, number grouping, and
                    multi-currency exchange rates are managed in Regional
                    Formats.
                  </p>
                </div>
              </div>
              <Link
                href="/settings/regional"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-blue-600 dark:border-[#1C2029] dark:bg-[#161B26] dark:text-[#F8FAFC] dark:hover:bg-[#1C2029] dark:hover:text-cyan-400"
              >
                Configure
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1C2029] dark:bg-[#0D1117]">
            <div className="flex items-center gap-2">
              {savedSuccess && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  Preferences saved successfully!
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-linear-135 from-blue-600 via-brand-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Preferences
            </button>
          </div>
        </div>

        {/* Appearance & Density Sidebar (1 Column) */}
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1C2029] dark:bg-[#0D1117]">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#1C2029]">
              <Palette className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Live Appearance Preview
              </h3>
            </div>
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-[#9BAEC9]">
                  Selected Theme:
                </span>
                <div className="mt-1 flex items-center gap-2 font-medium capitalize text-slate-900 dark:text-[#F1F5FC]">
                  {theme === "light" && (
                    <Sun className="h-4 w-4 text-amber-500" />
                  )}
                  {theme === "dark" && (
                    <Moon className="h-4 w-4 text-cyan-400" />
                  )}
                  {theme === "system" && (
                    <Monitor className="h-4 w-4 text-blue-500" />
                  )}
                  <span>{theme} Mode</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 dark:text-[#9BAEC9]">
                  Interface Density:
                </span>
                <div className="mt-1 flex items-center gap-2 font-medium capitalize text-slate-900 dark:text-[#F1F5FC]">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono dark:bg-[#161B26] dark:text-cyan-400">
                    {density}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {density === "compact" && "(6px cell padding)"}
                    {density === "comfortable" && "(10px cell padding)"}
                    {density === "spacious" && "(14px cell padding)"}
                  </span>
                </div>
              </div>

              {/* Sample Mini Table Row */}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[#1C2029] dark:bg-[#121620]">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Sample Data Row Preview
                </div>
                <div className="overflow-hidden rounded border border-slate-200 bg-white text-xs dark:border-[#1C2029] dark:bg-[#0D1117]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] text-slate-500 dark:bg-[#161B26] dark:text-slate-400">
                      <tr>
                        <th className="px-2 py-1 font-medium">User</th>
                        <th className="px-2 py-1 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-100 dark:border-[#1C2029]">
                        <td className="px-2 font-medium text-slate-800 dark:text-slate-200">
                          Alex Taylor
                        </td>
                        <td className="px-2">
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Active
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:border-[#1C2029] dark:bg-[#121620] dark:text-slate-300">
                Preferences apply immediately across navigation bars, buttons,
                tables, and dialogs.
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
