"use client";

import { Button, Checkbox, useToast } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useAssignUserTeams } from "../hooks";

// Default teams defined in seed/architecture
const DEFAULT_TEAMS = [
  { id: 1, name: "Software", code: "SW" },
  { id: 2, name: "Mechanical", code: "ME" },
  { id: 3, name: "Electrical", code: "EL" },
];

export interface AssignTeamsModalProps {
  userId: number;
  userName: string;
  currentTeams: Array<{ id: number; name: string; isLead: boolean }>;
  onClose: () => void;
}

export function AssignTeamsModal({
  userId,
  userName,
  currentTeams,
  onClose,
}: AssignTeamsModalProps) {
  const assignMutation = useAssignUserTeams();
  const { toast } = useToast();

  const [teamAssignments, setTeamAssignments] = useState<
    Map<number, { isLead: boolean }>
  >(new Map(currentTeams.map((t) => [t.id, { isLead: t.isLead }])));

  function toggleTeam(teamId: number) {
    setTeamAssignments((prev) => {
      const next = new Map(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.set(teamId, { isLead: false });
      }
      return next;
    });
  }

  function toggleLead(teamId: number) {
    setTeamAssignments((prev) => {
      const next = new Map(prev);
      const current = next.get(teamId);
      if (current) {
        next.set(teamId, { isLead: !current.isLead });
      }
      return next;
    });
  }

  async function handleSave() {
    try {
      const teams = [...teamAssignments.entries()].map(([teamId, data]) => ({
        teamId,
        isLead: data.isLead,
      }));
      await assignMutation.mutateAsync({
        id: userId,
        input: { teams },
      });
      toast({
        title: `Updated teams for "${userName}"`,
        variant: "success",
      });
      onClose();
    } catch {
      toast({ title: "Could not update teams", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {DEFAULT_TEAMS.map((team) => {
          const isSelected = teamAssignments.has(team.id);
          const isLead = teamAssignments.get(team.id)?.isLead ?? false;

          return (
            <div
              key={team.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-800"
            >
              <label className="flex items-center gap-2.5">
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleTeam(team.id)}
                  disabled={assignMutation.isPending}
                />
                <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">
                  {team.name} ({team.code})
                </span>
              </label>

              {isSelected && (
                <label className="flex items-center gap-2 text-theme-xs text-gray-600 dark:text-gray-400">
                  <Checkbox
                    checked={isLead}
                    onChange={() => toggleLead(team.id)}
                    disabled={assignMutation.isPending}
                  />
                  <span>Team Lead</span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={assignMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          loading={assignMutation.isPending}
          onClick={() => void handleSave()}
        >
          Save teams
        </Button>
      </div>
    </div>
  );
}
