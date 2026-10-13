"use client";

import { type TabItem, Tabs } from "@texawave-erp/ui-kit";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  BONUS_READ,
  LOAN_READ,
  MY_LOAN_READ,
  MY_PAYSLIP_READ,
  PAYMENT_READ,
  PAYROLL_READ,
  PAYROLL_SETTINGS_READ,
  PAYSLIP_READ,
  SALARY_READ,
  TAX_DECLARATION_READ,
} from "../permissions";
import { BonusesPanel } from "./BonusesPanel";
import { LoansPanel } from "./LoansPanel";
import { PaymentsPanel } from "./PaymentsPanel";
import { PayrollSettingsPanel } from "./PayrollSettingsPanel";
import { PayslipsPanel } from "./PayslipsPanel";
import { PeriodsPanel } from "./PeriodsPanel";
import { SalariesPanel } from "./SalariesPanel";
import { SalaryReportPanel } from "./SalaryReportPanel";
import { TaxDeclarationsPanel } from "./TaxDeclarationsPanel";
import { NoAccess, SectionHeader } from "./SectionHeader";

type PayrollTab =
  | "periods"
  | "salaries"
  | "bonuses"
  | "loans"
  | "payslips"
  | "payments"
  | "report"
  | "tax"
  | "settings";

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
  const canTax = usePermission(TAX_DECLARATION_READ);
  const canSettings = usePermission(PAYROLL_SETTINGS_READ);

  const tabs: TabItem<PayrollTab>[] = [];
  if (canPeriods) tabs.push({ id: "periods", label: "Periods & runs" });
  if (canSalaries) tabs.push({ id: "salaries", label: "Salaries" });
  if (canBonuses) tabs.push({ id: "bonuses", label: "Bonuses" });
  if (canLoans || canMyLoans) tabs.push({ id: "loans", label: "Loans" });
  if (canPayslips || canMyPayslips)
    tabs.push({ id: "payslips", label: "Payslips" });
  if (canPayments) tabs.push({ id: "payments", label: "Payments" });
  if (canPeriods) tabs.push({ id: "report", label: "Salary report" });
  if (canTax) tabs.push({ id: "tax", label: "Tax declarations" });
  if (canSettings) tabs.push({ id: "settings", label: "Settings" });

  // `?tab=loans` opens a tab directly (the loan notifications link there).
  const fromUrl = useSearchParams().get("tab") as PayrollTab | null;
  const [requested, setRequested] = useState<PayrollTab>(fromUrl ?? "periods");
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];

  return (
    // `contain: inline-size` keeps wide tables scrolling inside their own
    // wrapper instead of widening the dashboard's flex <main>.
    <div className="flex min-w-0 flex-col gap-6 [contain:inline-size]">
      <SectionHeader
        title="Payroll"
        description="Run monthly payroll, manage salary structures, bonuses, loans and tax declarations, issue payslips, payouts and statutory files, and set the payroll rules."
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
          {active.id === "salaries" ? <SalariesPanel /> : null}
          {active.id === "bonuses" ? <BonusesPanel /> : null}
          {active.id === "loans" ? <LoansPanel /> : null}
          {active.id === "payslips" ? <PayslipsPanel /> : null}
          {active.id === "payments" ? <PaymentsPanel /> : null}
          {active.id === "report" ? <SalaryReportPanel /> : null}
          {active.id === "tax" ? <TaxDeclarationsPanel /> : null}
          {active.id === "settings" ? <PayrollSettingsPanel /> : null}
        </Tabs>
      )}
    </div>
  );
}
