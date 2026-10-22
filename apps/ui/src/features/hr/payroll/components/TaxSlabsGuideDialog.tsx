"use client";

import { CheckCircle2, Info, ShieldCheck, X } from "lucide-react";
import { Button, Dialog } from "@texawave-erp/ui-kit";

export function TaxSlabsGuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Income Tax Slabs & Statutory Deductions Guide (FY 2026-27)"
      size="4xl"
    >
      <div className="flex flex-col gap-6 p-1">
        {/* Top Info Banner */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-xs text-sky-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-sky-200">
          <div className="flex items-center gap-2 font-bold text-brand-600 dark:text-sky-300">
            <ShieldCheck className="h-4 w-4" />
            <span>
              Statutory Regime Rules for Indian Payroll TDS Calculation
            </span>
          </div>
          <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-400">
            Under Section 115BAC, the <strong>New Tax Regime</strong> is the
            default tax regime. Employees opting for the New Regime benefit from
            lower slab rates and a ₹75,000 standard deduction, without requiring
            proof submissions for Chapter VI-A investments.
          </p>
        </div>

        {/* 2-Column Comparison: New Regime vs Old Regime */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* New Regime Card */}
          <div className="flex flex-col rounded-2xl border-2 border-brand-500 bg-white p-5 shadow-xs dark:border-brand-400 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
              <div>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                  Default Regime
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  New Tax Regime (Sec 115BAC)
                </h3>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Lower Tax Slabs
              </span>
            </div>

            <div className="mt-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Income Tax Slabs:
              </p>
              <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>Up to ₹3,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    Nil
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>₹3,00,001 – ₹7,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    5% (Full 87A rebate)
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>₹7,00,001 – ₹10,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    10%
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>₹10,00,001 – ₹12,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    15%
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>₹12,00,001 – ₹15,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    20%
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>Above ₹15,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    30%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3 text-xs dark:border-slate-800">
              <p className="font-bold text-slate-700 dark:text-slate-300">
                Allowances & Rebates:
              </p>
              <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Standard Deduction: <strong>₹75,000</strong>
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Section 87A Tax Rebate: Nil tax up to ₹7,00,000</span>
                </li>
                <li className="flex items-center gap-1.5 text-slate-500">
                  <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>No 80C, 80D, or HRA exemptions allowed</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Old Regime Card */}
          <div className="flex flex-col rounded-2xl border border-sky-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
              <div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Optional Regime
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  Old Tax Regime (With Deductions)
                </h3>
              </div>
              <span className="text-xs font-semibold text-brand-600 dark:text-sky-300">
                Maximum Deductions
              </span>
            </div>

            <div className="mt-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Income Tax Slabs:
              </p>
              <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>Up to ₹2,50,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    Nil
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>₹2,50,001 – ₹5,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    5% (87A rebate up to ₹5L)
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>₹5,00,001 – ₹10,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    20%
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
                  <span>Above ₹10,00,000</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    30%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3 text-xs dark:border-slate-800">
              <p className="font-bold text-slate-700 dark:text-slate-300">
                Eligible Statutory Exemptions:
              </p>
              <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                  <span>
                    Section 80C Investments: Max <strong>₹1,50,000</strong>
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                  <span>
                    Section 80D Mediclaim: Max{" "}
                    <strong>₹25,000 / ₹50,000</strong>
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                  <span>
                    Section 24(b) Home Loan Interest: Max{" "}
                    <strong>₹2,00,000</strong>
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                  <span>HRA Exemption: Based on actual rent & basic pay</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-100 pt-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Close Guide
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
