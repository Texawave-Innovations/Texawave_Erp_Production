import { ComplianceView } from "@/features/hr/payroll/components/ComplianceView";

// `app/` stays thin — routing only. Compliance shares the payroll feature
// folder, mirroring apps/api/src/modules/hr/payroll/compliance.
export default function HrCompliancePage() {
  return <ComplianceView />;
}
