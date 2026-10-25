// src/modules/projects/mom/components/AttendeeListManager.tsx

import React, { useState } from "react";
import { MomAttendee, AttendanceType } from "../types/mom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, User, UserX, Users } from "lucide-react";

interface AttendeeListManagerProps {
  attendees: MomAttendee[];
  absentees: MomAttendee[];
  onChangeAttendees: (attendees: MomAttendee[]) => void;
  onChangeAbsentees: (absentees: MomAttendee[]) => void;
  disabled?: boolean;
}

export const AttendeeListManager: React.FC<AttendeeListManagerProps> = ({
  attendees,
  absentees,
  onChangeAttendees,
  onChangeAbsentees,
  disabled = false,
}) => {
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newAttendance, setNewAttendance] = useState<AttendanceType>("present");

  const handleAddPerson = () => {
    if (!newName.trim()) return;

    const newPerson: MomAttendee = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: newName.trim(),
      role: newRole.trim() || "Stakeholder",
      organization: newOrg.trim() || "TexaWave",
      attendance: newAttendance,
    };

    if (newAttendance === "absent") {
      onChangeAbsentees([...absentees, newPerson]);
    } else {
      onChangeAttendees([...attendees, newPerson]);
    }

    setNewName("");
    setNewRole("");
    setNewOrg("");
    setNewAttendance("present");
  };

  const handleToggleAttendance = (
    person: MomAttendee,
    newStatus: AttendanceType,
  ) => {
    if (newStatus === "absent") {
      // Remove from attendees, add to absentees
      const updatedAttendees = attendees.filter((a) => a.id !== person.id);
      const updatedAbsentees = [
        ...absentees,
        { ...person, attendance: "absent" },
      ];
      onChangeAttendees(updatedAttendees);
    } else {
      // If was absent, move to attendees
      const wasAbsent = absentees.some((a) => a.id === person.id);
      if (wasAbsent) {
        const updatedAbsentees = absentees.filter((a) => a.id !== person.id);
        const updatedAttendees = [
          ...attendees,
          { ...person, attendance: newStatus },
        ];
        onChangeAbsentees(updatedAbsentees);
        onChangeAttendees(updatedAttendees);
      } else {
        const updatedAttendees = attendees.map((a) =>
          a.id === person.id ? { ...a, attendance: newStatus } : a,
        );
        onChangeAttendees(updatedAttendees);
      }
    }
  };

  const handleRemovePerson = (id: string, isAbsent: boolean) => {
    if (isAbsent) {
      onChangeAbsentees(absentees.filter((a) => a.id !== id));
    } else {
      onChangeAttendees(attendees.filter((a) => a.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Add Form */}
      {!disabled && (
        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" /> Add Meeting
            Participant
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name *"
              className="text-xs h-8 sm:col-span-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPerson();
                }
              }}
            />
            <Input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Designation / Role"
              className="text-xs h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPerson();
                }
              }}
            />
            <Input
              value={newOrg}
              onChange={(e) => setNewOrg(e.target.value)}
              placeholder="Organization"
              className="text-xs h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPerson();
                }
              }}
            />
            <div className="flex gap-1.5">
              <Select
                value={newAttendance}
                onValueChange={(val) => setNewAttendance(val as AttendanceType)}
              >
                <SelectTrigger className="text-xs h-8 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={handleAddPerson}
                disabled={!newName.trim()}
                style={{
                  background:
                    "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                }}
                className="text-white font-bold rounded-lg text-xs h-8 px-2.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Two columns: Attendees & Absentees */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Attendees Section */}
        <div className="border border-border rounded-xl p-3 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-emerald-600" />
              Attendees ({attendees.length})
            </span>
            <span className="text-[10px] text-muted-foreground">
              Present / Remote
            </span>
          </div>

          {attendees.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center italic">
              No attendees listed yet.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {attendees.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/60 text-xs"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-foreground truncate">
                      {person.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {person.role || "Member"}{" "}
                      {person.organization ? `• ${person.organization}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold px-1.5 py-0 cursor-pointer ${
                        person.attendance === "remote"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                      onClick={() =>
                        !disabled &&
                        handleToggleAttendance(
                          person,
                          person.attendance === "present"
                            ? "remote"
                            : "present",
                        )
                      }
                      title={
                        !disabled ? "Click to toggle Present/Remote" : undefined
                      }
                    >
                      {person.attendance === "remote" ? "Remote" : "Present"}
                    </Badge>
                    {!disabled && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            handleToggleAttendance(person, "absent")
                          }
                          className="h-6 w-6 text-muted-foreground hover:text-amber-600"
                          title="Mark as absent"
                        >
                          <UserX className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemovePerson(person.id, false)}
                          className="h-6 w-6 text-rose-400 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Absentees Section */}
        <div className="border border-border rounded-xl p-3 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <UserX className="h-3.5 w-3.5 text-amber-600" />
              Absentees ({absentees.length})
            </span>
            <span className="text-[10px] text-muted-foreground">
              Apologies received
            </span>
          </div>

          {absentees.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center italic">
              No absentees recorded.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {absentees.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-amber-50/40 border border-amber-200/60 text-xs"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-foreground truncate">
                      {person.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {person.role || "Member"}{" "}
                      {person.organization ? `• ${person.organization}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-300"
                    >
                      Absent
                    </Badge>
                    {!disabled && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            handleToggleAttendance(person, "present")
                          }
                          className="h-6 w-6 text-muted-foreground hover:text-emerald-600"
                          title="Mark as present"
                        >
                          <User className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemovePerson(person.id, true)}
                          className="h-6 w-6 text-rose-400 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
