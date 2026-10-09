"use client";

import { type TabItem, Tabs } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  BONUS_READ,
  LOAN_READ,
  MY_LOAN_READ,
  MY_PAYSLIP_READ,
  PAYMENT_READ,
  PAYROLL_READ,
  PAYSLIP_READ,
  SALARY_READ,
} from "../permissions";
import { PanelPlaceholder } from "./PanelPlaceholder";
import { PeriodsPanel } from "./PeriodsPanel";
import { SalaryReportPanel } from "./SalaryReportPanel";
import { NoAccess, SectionHeader } from "./SectionHeader";

type PayrollTab =
  | "periods"
  | "salaries"
  | "bonuses"
  | "loans"
  | "payslips"
  | "payments"
  | "report";

/** HR → Payroll. One tab per area; each shows only when the user can read
 * it. Payslips/Loans also show for an employee who can only see their own. */
export function PayrollView() {
  const canPeriods = usePermission(PAYROLL_READ);
  const canSalaries = usePermission(SALARY_READ);
  const canBonuses = usePermission(BONUS_READ);
  const canLoans = usePermission(LOAN_READ);
  const canMyLoans = usePermission(MY_LOAN_READ);
  const canPayslips = usePermission(PAYSLIP_READ);
  const canMyPayslips = usePermission(MY_PAYSLIP_READ);
  const canPayments = usePermission(PAYMENT_READ);

  const tabs: TabItem<PayrollTab>[] = [];
  if (canPeriods) tabs.push({ id: "periods", label: "Periods & runs" });
  if (canSalaries) tabs.push({ id: "salaries", label: "Salaries" });
  if (canBonuses) tabs.push({ id: "bonuses", label: "Bonuses" });
  if (canLoans || canMyLoans) tabs.push({ id: "loans", label: "Loans" });
  if (canPayslips || canMyPayslips)
    tabs.push({ id: "payslips", label: "Payslips" });
  if (canPayments) tabs.push({ id: "payments", label: "Payments" });
  if (canPeriods) tabs.push({ id: "report", label: "Salary report" });

  const [requested, setRequested] = useState<PayrollTab>("periods");
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];

  return (
    // `contain: inline-size` keeps wide tables scrolling inside their own
    // wrapper instead of widening the dashboard's flex <main>.
    <div className="flex min-w-0 flex-col gap-6 [contain:inline-size]">
      <SectionHeader
        title="Payroll"
        description="Run monthly payroll, manage salary structures, bonuses and loans, and issue payslips and payouts."
      />
      {!active ? (
        <NoAccess area="Payroll" />
      ) : (
        <Tabs
          label="Payroll sections"
          idPrefix="payroll"
          tabs={tabs}
          value={active.id}
          onChange={setRequested}
        >
          {active.id === "periods" ? <PeriodsPanel /> : null}
          {active.id === "salaries" ? (
            <PanelPlaceholder title="Salaries" />
          ) : null}
          {active.id === "bonuses" ? (
            <PanelPlaceholder title="Bonuses" />
          ) : null}
          {active.id === "loans" ? <PanelPlaceholder title="Loans" /> : null}
          {active.id === "payslips" ? (
            <PanelPlaceholder title="Payslips" />
          ) : null}
          {active.id === "payments" ? (
            <PanelPlaceholder title="Payments" />
          ) : null}
          {active.id === "report" ? <SalaryReportPanel /> : null}
        </Tabs>
      )}
    </div>
  );
}
