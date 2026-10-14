"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Textarea,
} from "@texawave-erp/ui-kit";
import type { TeamFormData, TeamItem } from "../types";

export interface TeamDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TeamFormData) => Promise<void> | void;
  team?: TeamItem | null;
  mode: "create" | "edit";
  loading?: boolean;
}

interface TeamDialogContentProps {
  onClose: () => void;
  onSubmit: (data: TeamFormData) => Promise<void> | void;
  team?: TeamItem | null | undefined;
  mode: "create" | "edit";
  loading?: boolean;
}

function TeamDialogContent({
  onClose,
  onSubmit,
  team,
  mode,
  loading = false,
}: TeamDialogContentProps) {
  const isEdit = mode === "edit";
  const [name, setName] = useState(isEdit && team ? team.name : "");
  const [description, setDescription] = useState(
    isEdit && team ? team.description || "" : "",
  );
  const [isActive, setIsActive] = useState(
    isEdit && team ? team.isActive : true,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) {
      nextErrors.name = "Team name is required.";
    } else if (name.trim().length < 2) {
      nextErrors.name = "Team name must be at least 2 characters.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      name: name.trim(),
      code: team?.code,
      description: description.trim(),
      isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400 -mt-1">
          {isEdit
            ? "View or update team information."
            : "Create a new team for your organization."}
        </p>
      </div>

      {/* Team Name */}
      <div>
        <label
          htmlFor="team-name"
          className="block text-theme-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          Team Name <span className="text-error-500">*</span>
        </label>
        <Input
          id="team-name"
          autoComplete="off"
          placeholder="Enter team name..."
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) {
              setErrors((prev) => ({ ...prev, name: "" }));
            }
          }}
          invalid={Boolean(errors.name)}
          disabled={loading}
        />
        {errors.name && (
          <p className="mt-1 text-theme-xs text-error-500">{errors.name}</p>
        )}
      </div>

      {/* Team Code (Read-Only in Edit/View Mode) */}
      {isEdit && team && (
        <div>
          <label
            htmlFor="team-code"
            className="block text-theme-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Team Code
          </label>
          <Input
            id="team-code"
            readOnly
            disabled
            value={team.code}
            className="bg-gray-50 font-mono text-gray-700 cursor-not-allowed dark:bg-gray-800/60 dark:text-gray-300"
          />
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            Code is generated automatically and cannot be edited.
          </p>
        </div>
      )}

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="team-description"
            className="block text-theme-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Description
          </label>
        </div>
        <Textarea
          id="team-description"
          rows={4}
          maxLength={500}
          placeholder="Enter team description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
        />
        <div className="mt-1 flex justify-end">
          <span className="text-theme-xs text-gray-400 dark:text-gray-500">
            {description.length} / 500
          </span>
        </div>
      </div>

      {/* Active Status Checkbox */}
      <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-900/40">
        <Checkbox
          id="team-active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={loading}
          className="mt-0.5"
        />
        <div className="flex flex-col">
          <label
            htmlFor="team-active"
            className="text-theme-sm font-semibold text-gray-900 dark:text-white cursor-pointer"
          >
            Active
          </label>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            {isEdit
              ? "Team is active and available for use."
              : "Team will be active after creation."}
          </span>
        </div>
      </div>

      {/* Modal Footer Actions */}
      <div className="mt-2 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="bg-brand-600 hover:bg-brand-700 text-white"
        >
          {isEdit ? "Update Team" : "Create Team"}
        </Button>
      </div>
    </form>
  );
}

export function TeamDialog({
  open,
  onClose,
  onSubmit,
  team,
  mode,
  loading = false,
}: TeamDialogProps) {
  const isEdit = mode === "edit";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Team Details" : "New Team"}
      size="lg"
    >
      {open ? (
        <TeamDialogContent
          key={isEdit && team ? `edit-${team.id}` : "create"}
          onClose={onClose}
          onSubmit={onSubmit}
          team={team}
          mode={mode}
          loading={loading}
        />
      ) : null}
    </Dialog>
  );
}
