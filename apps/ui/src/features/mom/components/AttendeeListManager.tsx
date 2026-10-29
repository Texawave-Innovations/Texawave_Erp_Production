"use client";

import type { MomAttendance, MomAttendee } from "@texawave-erp/api-types";
import { Button, Input, Select } from "@texawave-erp/ui-kit";
import { Plus, Trash2, User, UserX, Users } from "lucide-react";
import { useState } from "react";
import { attendanceOf, rowId } from "../utils";

export interface AttendeeListManagerProps {
  attendees: MomAttendee[];
  absentees: MomAttendee[];
  onChange: (next: {
    attendees: MomAttendee[];
    absentees: MomAttendee[];
  }) => void;
  disabled?: boolean;
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
}: AttendeeListManagerProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [organization, setOrganization] = useState("");
  const [attendance, setAttendance] = useState<MomAttendance>("present");

  function addPerson() {
    if (!name.trim()) return;
    const person: MomAttendee = {
      id: rowId("att"),
      name: name.trim(),
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PeopleColumn
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
                      label={`Mark ${p.name} absent`}
                      onClick={() => setPersonAttendance(p, "absent")}
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Remove ${p.name}`}
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
                      label={`Mark ${p.name} present`}
                      onClick={() => setPersonAttendance(p, "present")}
                    >
                      <User className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Remove ${p.name}`}
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
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  empty: string;
  people: MomAttendee[];
  renderBadge: (p: MomAttendee) => React.ReactNode;
  actions?: ((p: MomAttendee) => React.ReactNode) | undefined;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
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
          {people.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2 dark:border-gray-800 dark:bg-gray-800/40"
            >
              <div className="min-w-0">
                <p className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                  {p.name}
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
