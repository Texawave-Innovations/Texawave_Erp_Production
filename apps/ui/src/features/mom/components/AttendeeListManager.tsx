"use client";

import type { MomAttendance, MomAttendee } from "@texawave-erp/api-types";
import { Button, Input, Select, useToast } from "@texawave-erp/ui-kit";
import { AlertCircle, Plus, Trash2, User, UserX, Users } from "lucide-react";
import { useState } from "react";
import { useEmployees } from "@/features/hr/employees/hooks";
import { attendanceOf, isSamePersonName, rowId } from "../utils";

export interface AttendeeListManagerProps {
  attendees: MomAttendee[];
  absentees: MomAttendee[];
  onChange: (next: {
    attendees: MomAttendee[];
    absentees: MomAttendee[];
  }) => void;
  disabled?: boolean | undefined;
  error?: string | undefined;
}

/** Legacy `mom/components/AttendeeListManager.tsx` — quick-add row plus
 * two columns (Attendees present/remote, Absentees). Moving someone between
 * columns updates both lists in one change (legacy dropped the absentee side
 * of that move). */
export function AttendeeListManager({
  attendees,
  absentees,
  onChange,
  disabled = false,
  error,
}: AttendeeListManagerProps) {
  const { toast } = useToast();
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const employees = employeesQuery.data?.data ?? [];
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [organization, setOrganization] = useState("");
  const [attendance, setAttendance] = useState<MomAttendance>("present");

  function addPerson() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const isDuplicate =
      attendees.some((a) => isSamePersonName(a.name, trimmedName)) ||
      absentees.some((a) => isSamePersonName(a.name, trimmedName));

    if (isDuplicate) {
      toast({
        title: "Duplicate Participant",
        description: `${trimmedName} is already on the participants list.`,
        variant: "warning",
      });
      return;
    }
    const person: MomAttendee = {
      id: rowId("att"),
      name: trimmedName,
      role: role.trim() || undefined,
      organization: organization.trim() || undefined,
      attendance,
    };
    if (attendance === "absent") {
      onChange({ attendees, absentees: [...absentees, person] });
    } else {
      onChange({ attendees: [...attendees, person], absentees });
    }
    setName("");
    setRole("");
    setOrganization("");
    setAttendance("present");
  }

  function setPersonAttendance(person: MomAttendee, next: MomAttendance) {
    const wasAbsent = absentees.some((a) => a.id === person.id);
    if (next === "absent") {
      onChange({
        attendees: attendees.filter((a) => a.id !== person.id),
        absentees: wasAbsent
          ? absentees
          : [...absentees, { ...person, attendance: "absent" }],
      });
      return;
    }
    if (wasAbsent) {
      onChange({
        attendees: [...attendees, { ...person, attendance: next }],
        absentees: absentees.filter((a) => a.id !== person.id),
      });
      return;
    }
    onChange({
      attendees: attendees.map((a) =>
        a.id === person.id ? { ...a, attendance: next } : a,
      ),
      absentees,
    });
  }

  function removePerson(id: string, absent: boolean) {
    onChange(
      absent
        ? { attendees, absentees: absentees.filter((a) => a.id !== id) }
        : { attendees: attendees.filter((a) => a.id !== id), absentees },
    );
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addPerson();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!disabled ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
          <p className="mb-2 flex items-center gap-1.5 text-theme-xs font-semibold text-gray-800 dark:text-gray-200">
            <Users className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
            Add Meeting Participant
          </p>

          <div className="mb-3">
            <label className="mb-1 block text-theme-xs font-medium text-gray-600 dark:text-gray-400">
              Select Company Employee
            </label>
            <Select
              aria-label="Select existing employee"
              value=""
              disabled={disabled || employeesQuery.isPending}
              onChange={(e) => {
                const empId = Number(e.target.value);
                if (!empId) return;
                const emp = employees.find((x) => x.id === empId);
                if (emp) {
                  setName(emp.fullName);
                  setRole(emp.designation?.name || "Staff");
                  setOrganization("TexaWave Innovations");
                }
              }}
            >
              <option value="">
                {employeesQuery.isPending
                  ? "Loading employees..."
                  : employeesQuery.isError
                    ? "Failed to load employees"
                    : employees.length === 0
                      ? "No employees found"
                      : "Select employee to autofill..."}
              </option>
              {employees.map((emp) => {
                const isAlreadyAdded =
                  attendees.some((a) =>
                    isSamePersonName(a.name, emp.fullName),
                  ) ||
                  absentees.some((a) => isSamePersonName(a.name, emp.fullName));
                return (
                  <option key={emp.id} value={emp.id} disabled={isAlreadyAdded}>
                    {emp.fullName || `Employee #${emp.id}`} ({emp.employeeCode}
                    {emp.designation?.name ? ` · ${emp.designation.name}` : ""}
                    {emp.team?.name ? ` · ${emp.team.name}` : ""})
                    {isAlreadyAdded ? " — Already added" : ""}
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
            <Input
              aria-label="Participant name"
              placeholder="Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onEnter}
              className="sm:col-span-2"
            />
            <Input
              aria-label="Designation or role"
              placeholder="Designation / Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={onEnter}
            />
            <Input
              aria-label="Organization"
              placeholder="Organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              onKeyDown={onEnter}
            />
            <Select
              aria-label="Attendance"
              value={attendance}
              onChange={(e) => setAttendance(e.target.value as MomAttendance)}
            >
              <option value="present">Present</option>
              <option value="remote">Remote</option>
              <option value="absent">Absent</option>
            </Select>
            <Button type="button" onClick={addPerson} disabled={!name.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50/70 p-3 text-theme-xs font-medium text-error-600 dark:border-error-900/60 dark:bg-error-950/40 dark:text-error-400"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-error-500" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PeopleColumn
          hasError={Boolean(error)}
          title={`Attendees (${attendees.length})`}
          hint="Present / Remote"
          icon={
            <User className="h-3.5 w-3.5 text-success-600 dark:text-success-400" />
          }
          empty="No attendees listed yet."
          people={attendees}
          renderBadge={(p) => {
            const remote = attendanceOf(p) === "remote";
            return (
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  setPersonAttendance(p, remote ? "present" : "remote")
                }
                title={disabled ? undefined : "Toggle present / remote"}
                className={
                  remote
                    ? "rounded-full bg-sky-50 px-2 py-0.5 text-theme-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                    : "rounded-full bg-success-50 px-2 py-0.5 text-theme-xs font-semibold text-success-700 dark:bg-success-950 dark:text-success-300"
                }
              >
                {remote ? "Remote" : "Present"}
              </button>
            );
          }}
          actions={
            disabled
              ? undefined
              : (p) => (
                  <>
                    <IconButton
                      label={`Mark ${p.name?.trim() ? p.name : "participant"} absent`}
                      onClick={() => setPersonAttendance(p, "absent")}
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Remove ${p.name?.trim() ? p.name : "participant"}`}
                      danger
                      onClick={() => removePerson(p.id, false)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </>
                )
          }
        />
        <PeopleColumn
          title={`Absentees (${absentees.length})`}
          hint="Apologies received"
          icon={
            <UserX className="h-3.5 w-3.5 text-warning-600 dark:text-warning-400" />
          }
          empty="No absentees recorded."
          people={absentees}
          renderBadge={() => (
            <span className="rounded-full bg-warning-50 px-2 py-0.5 text-theme-xs font-semibold text-warning-700 dark:bg-warning-950 dark:text-warning-300">
              Absent
            </span>
          )}
          actions={
            disabled
              ? undefined
              : (p) => (
                  <>
                    <IconButton
                      label={`Mark ${p.name?.trim() ? p.name : "participant"} present`}
                      onClick={() => setPersonAttendance(p, "present")}
                    >
                      <User className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Remove ${p.name?.trim() ? p.name : "participant"}`}
                      danger
                      onClick={() => removePerson(p.id, true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </>
                )
          }
        />
      </div>
    </div>
  );
}

function PeopleColumn({
  title,
  hint,
  icon,
  empty,
  people,
  renderBadge,
  actions,
  hasError = false,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  empty: string;
  people: MomAttendee[];
  renderBadge: (p: MomAttendee) => React.ReactNode;
  actions?: ((p: MomAttendee) => React.ReactNode) | undefined;
  hasError?: boolean | undefined;
}) {
  return (
    <div
      className={
        hasError
          ? "flex flex-col gap-2 rounded-xl border border-rose-300 bg-white p-3 dark:border-rose-700 dark:bg-gray-900"
          : "flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
      }
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-theme-xs font-semibold text-gray-800 dark:text-gray-200">
          {icon}
          {title}
        </span>
        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
          {hint}
        </span>
      </div>
      {people.length === 0 ? (
        <p className="py-3 text-center text-theme-xs italic text-gray-500 dark:text-gray-400">
          {empty}
        </p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-1">
          {people.map((p, idx) => (
            <li
              key={p.id || `people-${p.name || idx}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2 dark:border-gray-800 dark:bg-gray-800/40"
            >
              <div className="min-w-0">
                <p className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                  {p.name?.trim() ? p.name : "(Unnamed participant)"}
                </p>
                <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {p.role || "Member"}
                  {p.organization ? ` · ${p.organization}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {renderBadge(p)}
                {actions ? actions(p) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        danger
          ? "rounded-md p-1 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-950"
          : "rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      }
    >
      {children}
    </button>
  );
}
