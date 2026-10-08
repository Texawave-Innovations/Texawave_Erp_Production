"use client";

import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function HrPayrollPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={["HR", "Finance", "Payroll"]}
        title="Payroll & Compensation"
        description="Salary structures, monthly payroll runs, and automated payslip generation."
      />

      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
          <Banknote className="h-7 w-7" />
        </span>
        <h3 className="mt-4 text-theme-base font-bold text-gray-900 dark:text-white">
          Payroll Engine
        </h3>
        <p className="mt-1 max-w-md text-theme-xs text-gray-500 dark:text-gray-400">
          Monthly payroll cycles, PF/ESI statutory compliance, and salary slip
          dispatch (Docs/ARCHITECTURE.md §5.6).
        </p>
      </div>
    </div>
  );
}
