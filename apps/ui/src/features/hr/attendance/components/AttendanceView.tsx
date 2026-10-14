"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Download, Upload, UserCheck } from "lucide-react";
import { Alert, Button, Tabs, type TabItem } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { HrPageHeader } from "@/features/hr/components/HrPageHeader";
import {
  EXPORT_ANY_SCOPE,
  IMPORT_TEAM_OR_ALL,
  LOCK_READ_ANY_SCOPE,
  READ_ANY_SCOPE,
  REPORT_READ_ANY_SCOPE,
  SELF_SERVICE_READ,
} from "../permissions";
import { AttendanceRecordsTab } from "./AttendanceRecordsTab";
import { DailyAttendanceTab } from "./DailyAttendanceTab";
import { EmployeeMonthTab } from "./EmployeeMonthTab";
import { ExportAttendanceDialog } from "./ExportAttendanceDialog";
import { ImportAttendanceDialog } from "./ImportAttendanceDialog";
import { MissingPunchesTab } from "./MissingPunchesTab";
import { MonthCloseTab } from "./MonthCloseTab";

type TabId = "daily" | "records" | "employee" | "missing" | "close";

/**
 * HR Attendance (legacy Attendance + Timesheet Approvals). Each tab is shown
 * only to holders of the permission its endpoint needs; the API remains the
 * authority (Docs/HR_API.md → Attendance).
 */
export function AttendanceView() {
  const router = useRouter();
  const canRead = usePermission(READ_ANY_SCOPE);
  const canReport = usePermission(REPORT_READ_ANY_SCOPE);
  const canLock = usePermission(LOCK_READ_ANY_SCOPE);
  const canExport = usePermission(EXPORT_ANY_SCOPE);
  const canImport = usePermission(IMPORT_TEAM_OR_ALL);
  const canSelfService = usePermission(SELF_SERVICE_READ);
  const [dialog, setDialog] = useState<"export" | "import" | null>(null);

  const tabs = useMemo(() => {
    const out: TabItem<TabId>[] = [];
    if (canReport) out.push({ id: "daily", label: "Daily roster" });
    if (canRead) out.push({ id: "records", label: "Records" });
    if (canRead && canReport)
      out.push({ id: "employee", label: "Employee month" });
    if (canReport) out.push({ id: "missing", label: "Missing punches" });
    if (canLock) out.push({ id: "close", label: "Month close" });
    return out;
  }, [canRead, canReport, canLock]);

  const [chosen, setChosen] = useState<TabId | null>(null);
  const tab = tabs.find((t) => t.id === chosen)?.id ?? tabs[0]?.id ?? null;

  if (tab === null) {
    return (
      <Alert variant="warning" title="You don't have access to attendance">
        Ask an administrator for the <code>hr.attendance.read</code> or{" "}
        <code>hr.attendance_report.read</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <HrPageHeader
        title="Attendance"
        description="Daily presence, punches, missing punches and the monthly close for payroll."
        icon={Clock}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canSelfService ? (
              <Button
                variant="secondary"
                onClick={() => router.push("/portal/attendance")}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium"
              >
                <UserCheck className="h-4 w-4 text-white" />
                <span>My Attendance</span>
              </Button>
            ) : null}
            {canImport ? (
              <Button
                variant="secondary"
                onClick={() => setDialog("import")}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium"
              >
                <Upload className="h-4 w-4 text-white" />
                <span>Import punches</span>
              </Button>
            ) : null}
            {canExport ? (
              <Button
                variant="secondary"
                onClick={() => setDialog("export")}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium"
              >
                <Download className="h-4 w-4 text-white" />
                <span>Export CSV</span>
              </Button>
            ) : null}
          </div>
        }
      />

      <Tabs
        label="Attendance sections"
        idPrefix="attendance"
        tabs={tabs}
        value={tab}
        onChange={setChosen}
      >
        {tab === "daily" ? <DailyAttendanceTab /> : null}
        {tab === "records" ? <AttendanceRecordsTab /> : null}
        {tab === "employee" ? <EmployeeMonthTab /> : null}
        {tab === "missing" ? <MissingPunchesTab /> : null}
        {tab === "close" ? <MonthCloseTab /> : null}
      </Tabs>

      {dialog === "export" ? (
        <ExportAttendanceDialog open onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "import" ? (
        <ImportAttendanceDialog open onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
