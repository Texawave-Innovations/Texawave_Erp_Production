"use client";

import { useMemo, useState } from "react";
import {
  Shield,
  Building2,
  Compass,
  Tag,
  Settings,
  Users,
  UserCheck,
  TrendingUp,
  ShoppingCart,
  Package,
  Landmark,
  Folder,
  Search,
  Info,
  Check,
  X,
  Save,
  type LucideIcon,
} from "lucide-react";
import { Button, Input } from "@texawave-erp/ui-kit";
import {
  type ParsedAction,
  type ParsedModule,
} from "../../utils/permission-parser";

export interface RolePermissionsTabProps {
  modules: ParsedModule[];
  initialSelectedModuleKey?: string | undefined;
  selectedPermissionIds: Set<number>;
  isSaving: boolean;
  hasChanges: boolean;
  onToggleAction: (action: ParsedAction) => void;
  onGrantModule: (moduleKey: string) => void;
  onRevokeModule: (moduleKey: string) => void;
  onSave: () => void;
  onDiscard: () => void;
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  all: Shield,
  departments: Building2,
  menu: Compass,
  reference: Tag,
  settings: Settings,
  users: Users,
  hr: UserCheck,
  sales: TrendingUp,
  purchases: ShoppingCart,
  inventory: Package,
  finance: Landmark,
  projects: Folder,
  general: Package,
};

function getModuleIcon(key: string): LucideIcon {
  return MODULE_ICONS[key] ?? Package;
}

export function RolePermissionsTab({
  modules,
  initialSelectedModuleKey,
  selectedPermissionIds,
  isSaving,
  hasChanges,
  onToggleAction,
  onGrantModule,
  onRevokeModule,
  onSave,
  onDiscard,
}: RolePermissionsTabProps) {
  const [selectedModuleKey, setSelectedModuleKey] = useState<string>(
    initialSelectedModuleKey || (modules[0]?.key ?? "departments"),
  );
  const [moduleSearch, setModuleSearch] = useState("");

  // Total catalog permission count
  const totalPermissionsCount = useMemo(() => {
    return modules.reduce((sum, m) => sum + m.totalPermissions, 0);
  }, [modules]);

  // Overall Access Overview statistics
  const grantedCount = useMemo(() => {
    return modules
      .flatMap((m) => m.allPermissionIds)
      .filter((id) => selectedPermissionIds.has(id)).length;
  }, [modules, selectedPermissionIds]);

  const noAccessCount = Math.max(0, totalPermissionsCount - grantedCount);

  const accessPercentage =
    totalPermissionsCount > 0
      ? Math.round((grantedCount / totalPermissionsCount) * 100)
      : 0;

  // Filter modules for left navigator
  const filteredModules = useMemo(() => {
    const q = moduleSearch.toLowerCase().trim();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
    );
  }, [modules, moduleSearch]);

  // Active module resolution
  const isAllModules = selectedModuleKey === "all";
  const activeModule = useMemo(() => {
    if (isAllModules) return null;
    return modules.find((m) => m.key === selectedModuleKey) || modules[0];
  }, [modules, selectedModuleKey, isAllModules]);

  return (
    <div className="flex flex-col gap-6">
      {/* Two-Column Workspace Layout */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Modules Navigator */}
        <div className="flex flex-col lg:col-span-4 xl:col-span-3.5">
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
            <div className="flex flex-col gap-3">
              <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white/90">
                Modules
              </h3>

              {/* Search Input */}
              <div>
                <label htmlFor="module-search-input" className="sr-only">
                  Search modules
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <Input
                    id="module-search-input"
                    placeholder="Search modules..."
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    className="w-full pl-8 text-theme-xs"
                  />
                </div>
              </div>

              {/* Module Items Navigation */}
              <div
                role="tablist"
                aria-label="Permission modules"
                className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800"
              >
                {/* All Modules Option */}
                <button
                  type="button"
                  role="tab"
                  aria-selected={isAllModules}
                  onClick={() => setSelectedModuleKey("all")}
                  className={`relative flex items-center justify-between p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 ${
                    isAllModules
                      ? "bg-brand-50/80 font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border-l-4 border-brand-500"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="text-theme-sm">All Modules</span>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {totalPermissionsCount}
                  </span>
                </button>

                {/* Dynamic Modules List */}
                {filteredModules.map((mod) => {
                  const isSelected = selectedModuleKey === mod.key;
                  const IconComp = getModuleIcon(mod.key);

                  return (
                    <button
                      key={mod.key}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedModuleKey(mod.key)}
                      className={`relative flex items-center justify-between p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 ${
                        isSelected
                          ? "bg-brand-50/80 font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border-l-4 border-brand-500"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComp className="h-4 w-4 shrink-0" />
                        <span className="text-theme-sm">{mod.name}</span>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {mod.totalPermissions}
                      </span>
                    </button>
                  );
                })}

                {filteredModules.length === 0 ? (
                  <div className="p-4 text-center text-theme-xs text-gray-500 dark:text-gray-400">
                    No modules match &ldquo;{moduleSearch}&rdquo;
                  </div>
                ) : null}
              </div>
            </div>

            {/* Access Overview Card docked at bottom of left sidebar */}
            <div className="mt-5 flex flex-col gap-3.5 border-t border-gray-100 pt-4 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-theme-sm font-bold text-gray-900 dark:text-white/90">
                    Access Overview
                  </h4>
                  <span
                    className="cursor-help text-xs text-gray-400 dark:text-gray-500"
                    title="Overall percentage and count of catalog permissions granted to this role"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedModuleKey("all")}
                  className="text-theme-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  View Details
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                {/* Circular Donut Ring */}
                <div className="relative flex h-18 w-18 shrink-0 items-center justify-center">
                  <svg
                    className="h-full w-full -rotate-90 transform"
                    viewBox="0 0 68 68"
                  >
                    <circle
                      cx="34"
                      cy="34"
                      r="26"
                      stroke="currentColor"
                      strokeWidth="5.5"
                      fill="transparent"
                      className="text-gray-100 dark:text-gray-800"
                    />
                    <circle
                      cx="34"
                      cy="34"
                      r="26"
                      stroke="currentColor"
                      strokeWidth="5.5"
                      fill="transparent"
                      strokeDasharray={163.36}
                      strokeDashoffset={
                        163.36 - (accessPercentage / 100) * 163.36
                      }
                      strokeLinecap="round"
                      className="text-brand-500 transition-all duration-300 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold leading-none text-gray-900 dark:text-white/90">
                      {accessPercentage}%
                    </span>
                    <span className="mt-0.5 text-[8px] font-bold tracking-wider text-gray-400 dark:text-gray-500 uppercase">
                      ACCESS
                    </span>
                  </div>
                </div>

                {/* Legend and Counts */}
                <div className="flex flex-1 flex-col gap-2.5 pl-2">
                  <div className="flex items-center justify-between text-theme-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-brand-500" />
                      <span className="text-gray-600 dark:text-gray-300">
                        Granted Access
                      </span>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white/90">
                      {grantedCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-theme-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                      <span className="text-gray-600 dark:text-gray-300">
                        No Access
                      </span>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white/90">
                      {noAccessCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Permissions Panel */}
        <div className="flex flex-col lg:col-span-8 xl:col-span-8.5">
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
            {isAllModules ? (
              /* All Modules Overview View (§11) */
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3.5 border-b border-gray-100 pb-4 dark:border-gray-800">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 shadow-theme-xs dark:bg-brand-950/50">
                    <Shield className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-theme-base font-bold text-gray-900 dark:text-white/90">
                      All Modules
                    </h3>
                    <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                      {modules.length} modules · {totalPermissionsCount}{" "}
                      permissions available across your organization.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50/70 p-3.5 text-theme-xs text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
                  Select a module from the list on the left or click a module
                  card below to configure permissions.
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {modules.map((mod, idx) => {
                    const modGrantedCount = mod.allPermissionIds.filter((id) =>
                      selectedPermissionIds.has(id),
                    ).length;
                    const CardIcon = getModuleIcon(mod.key);
                    const isLastOdd =
                      idx === modules.length - 1 && modules.length % 2 === 1;

                    return (
                      <div
                        key={mod.key}
                        className={`flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs transition-shadow hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark ${
                          isLastOdd ? "sm:col-span-2" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            <CardIcon className="h-5 w-5" />
                          </span>
                          <div className="flex flex-col">
                            <h4 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                              {mod.name}
                            </h4>
                            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                              {mod.description}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                          <span className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">
                            {modGrantedCount} of {mod.totalPermissions} granted
                          </span>

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedModuleKey(mod.key)}
                            className="text-theme-xs py-1 px-2.5 whitespace-nowrap shrink-0"
                          >
                            Configure →
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeModule ? (
              /* Specific Module Permissions View */
              <div className="flex flex-col gap-5">
                {/* Module Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 shadow-theme-xs dark:bg-brand-950/50">
                      {(() => {
                        const ActiveModIcon = getModuleIcon(activeModule.key);
                        return (
                          <ActiveModIcon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                        );
                      })()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-theme-base font-bold text-gray-900 dark:text-white/90">
                        {activeModule.name}
                      </h3>
                      <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                        {activeModule.description}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons: Select all & Clear all */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onGrantModule(activeModule.key)}
                      aria-label={`Select all permissions in ${activeModule.name}`}
                      className="gap-1.5 text-theme-xs whitespace-nowrap shrink-0"
                    >
                      <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                      <span className="whitespace-nowrap">Select all</span>
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onRevokeModule(activeModule.key)}
                      aria-label={`Clear all permissions in ${activeModule.name}`}
                      className="gap-1.5 text-theme-xs whitespace-nowrap shrink-0"
                    >
                      <X className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                      <span className="whitespace-nowrap">Clear all</span>
                    </Button>
                  </div>
                </div>

                {/* Clean, Non-Overflowing Permission Table */}
                <div className="w-full">
                  <table className="w-full table-fixed text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70 text-theme-xs font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                        <th scope="col" className="w-4/12 py-3 pl-4 pr-3">
                          Permission
                        </th>
                        <th scope="col" className="w-5/12 py-3 px-3">
                          Description
                        </th>
                        <th
                          scope="col"
                          className="w-3/12 py-3 pl-3 pr-4 text-right"
                        >
                          Access
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {activeModule.resources.flatMap((res) =>
                        res.actions.map((act) => {
                          const isGranted = act.allIds.some((id) =>
                            selectedPermissionIds.has(id),
                          );

                          return (
                            <tr
                              key={`${activeModule.key}-${res.resource}-${act.action}`}
                              className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                            >
                              {/* 1. Human-Readable Permission Name (NO raw codes) */}
                              <td className="w-4/12 py-3.5 pl-4 pr-3 align-middle">
                                <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90 wrap-break-word">
                                  {act.label}
                                </span>
                              </td>

                              {/* 2. Human-Readable Description (NO raw codes) */}
                              <td className="w-5/12 py-3.5 px-3 align-middle">
                                <span className="text-theme-xs text-gray-500 dark:text-gray-400 wrap-break-word">
                                  {act.description}
                                </span>
                              </td>

                              {/* 3. Access State (Granted/Disabled) + Accessible Switch */}
                              <td className="w-3/12 py-3.5 pl-3 pr-4 align-middle text-right">
                                <div className="flex items-center justify-end gap-2.5">
                                  <span
                                    className={`text-theme-xs font-semibold whitespace-nowrap ${
                                      isGranted
                                        ? "text-brand-600 dark:text-brand-400"
                                        : "text-gray-400 dark:text-gray-500"
                                    }`}
                                  >
                                    {isGranted ? "Granted" : "Disabled"}
                                  </span>

                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isGranted}
                                    aria-label={`${
                                      isGranted ? "Revoke" : "Grant"
                                    } ${act.label} permission`}
                                    onClick={() => onToggleAction(act)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 ${
                                      isGranted
                                        ? "bg-brand-500 dark:bg-brand-500"
                                        : "bg-gray-200 dark:bg-gray-700"
                                    }`}
                                  >
                                    <span className="sr-only">
                                      {isGranted
                                        ? `Revoke ${act.label}`
                                        : `Grant ${act.label}`}
                                    </span>
                                    <span
                                      aria-hidden="true"
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-theme-xs ring-0 transition duration-200 ease-in-out ${
                                        isGranted
                                          ? "translate-x-5"
                                          : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar: Discard Changes & Save Changes */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
        <div>
          {hasChanges ? (
            <div className="flex items-center gap-2 text-theme-xs font-semibold text-warning-700 dark:text-warning-300">
              <span className="h-2 w-2 rounded-full bg-warning-500 animate-pulse" />
              <span>Unsaved changes pending</span>
            </div>
          ) : (
            <span className="text-theme-xs text-gray-400 dark:text-gray-500">
              All permissions are saved.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onDiscard}
            disabled={!hasChanges || isSaving}
            className="shadow-theme-xs"
          >
            Discard Changes
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={onSave}
            loading={isSaving}
            disabled={!hasChanges || isSaving}
            className="gap-2 shadow-theme-xs"
          >
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
