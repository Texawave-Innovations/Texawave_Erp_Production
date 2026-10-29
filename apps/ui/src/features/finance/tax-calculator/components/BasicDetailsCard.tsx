"use client";

import React from "react";
import { TaxpayerProfile, EmploymentType } from "../engine/types";
import { Check } from "lucide-react";

interface Props {
  profile: TaxpayerProfile;
  onChange: (updated: Partial<TaxpayerProfile>) => void;
  onNext: () => void;
}

export function BasicDetailsCard({ profile, onChange, onNext }: Props) {
  return (
    <div className="space-y-6 text-left relative focus-within:z-30">
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Basic Taxpayer Details
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select statutory financial year, age bracket, and employment category
          under the Income-tax Act.
        </p>
      </div>

      <div className="space-y-6">
        {/* Financial Year Selector Cards */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 mb-2.5">
            Financial Year (Assessment Year)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange({ financialYear: "2025-26" })}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                profile.financialYear === "2025-26"
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-sm ring-1 ring-blue-500"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                    profile.financialYear === "2025-26"
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 dark:border-slate-700"
                  }`}
                >
                  {profile.financialYear === "2025-26" && (
                    <Check size={12} strokeWidth={3} />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    FY 2025–26
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    (AY 2026–27 — Budget 2025)
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChange({ financialYear: "2026-27" })}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                profile.financialYear === "2026-27"
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-sm ring-1 ring-blue-500"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                    profile.financialYear === "2026-27"
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 dark:border-slate-700"
                  }`}
                >
                  {profile.financialYear === "2026-27" && (
                    <Check size={12} strokeWidth={3} />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    FY 2026–27
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    (AY 2027–28 Planning)
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Age Category Selector */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 mb-2.5">
            Age Category (Old Regime Basic Exemption)
          </label>
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => onChange({ ageCategory: "regular" })}
              className={`min-h-11 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                profile.ageCategory === "regular"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {profile.ageCategory === "regular" && (
                <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <Check size={9} strokeWidth={3} />
                </div>
              )}
              <span>Below 60 yrs</span>
            </button>

            <button
              type="button"
              onClick={() => onChange({ ageCategory: "senior" })}
              className={`min-h-11 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                profile.ageCategory === "senior"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {profile.ageCategory === "senior" && (
                <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <Check size={9} strokeWidth={3} />
                </div>
              )}
              <span>60 – 79 yrs (Senior)</span>
            </button>

            <button
              type="button"
              onClick={() => onChange({ ageCategory: "super_senior" })}
              className={`min-h-11 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                profile.ageCategory === "super_senior"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {profile.ageCategory === "super_senior" && (
                <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <Check size={9} strokeWidth={3} />
                </div>
              )}
              <span>80+ yrs (Super)</span>
            </button>
          </div>
        </div>

        {/* Employment Type */}
        <div className="relative focus-within:z-30">
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Employment Type
          </label>
          <div className="relative">
            <select
              value={profile.employmentType}
              onChange={(e) =>
                onChange({ employmentType: e.target.value as EmploymentType })
              }
              className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer appearance-none"
            >
              <option value="salaried">
                Salaried Individual (Eligible for Standard Deduction)
              </option>
              <option value="pensioner">
                Pensioner (Eligible for Standard Deduction)
              </option>
              <option value="self_employed">
                Self-Employed / Professional / Business
              </option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <svg
                width="12"
                height="8"
                viewBox="0 0 12 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1.5L6 6.5L11 1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Next Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onNext}
            className="w-full sm:w-auto min-h-11 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <span>Proceed to Income Details</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
