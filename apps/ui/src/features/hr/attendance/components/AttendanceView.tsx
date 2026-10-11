"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, UserCheck } from "lucide-react";
import { Alert, Button, Tabs, type TabItem } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Attendance
          </h1>
          <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
            Daily presence, punches, missing punches and the monthly close for
            payroll.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSelfService ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/portal/attendance")}
            >
              <UserCheck className="mr-1.5 h-4 w-4" />
              My attendance
            </Button>
          ) : null}
          {canImport ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialog("import")}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Import punches
            </Button>
          ) : null}
          {canExport ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialog("export")}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
          ) : null}
        </div>
      </div>

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
