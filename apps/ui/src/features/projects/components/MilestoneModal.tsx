"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { useCreateMilestone, useUpdateMilestone } from "../hooks";
import { errorMessage, toDateInput, todayInput } from "../format";
import type { MilestoneStatus, ProjectMilestone } from "../types";

export interface MilestoneModalProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  milestoneToEdit?: ProjectMilestone | null;
  currentMilestoneCount?: number;
}

/** Legacy `components/MilestoneModal.tsx` — add/edit a milestone with
 * sequence order, target/actual dates and (edit only) status. */
export function MilestoneModal(props: MilestoneModalProps) {
  const { open, onClose, milestoneToEdit } = props;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-3">
          <span className="rounded-xl bg-sky-50 p-2 text-brand-600 dark:bg-sky-950/40 dark:text-cyan-400">
            <Flag className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold text-gray-900 dark:text-white">
              {milestoneToEdit ? "Edit Milestone" : "Add New Milestone"}
            </span>
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Set milestone goals, sequencing order &amp; target delivery dates
            </span>
          </span>
        </span>
      }
    >
      {/* Mounted only while open so each opening seeds fresh form state. */}
      {open ? <MilestoneForm {...props} /> : null}
    </Dialog>
  );
}

function MilestoneForm({
  onClose,
  projectId,
  milestoneToEdit,
  currentMilestoneCount = 0,
}: MilestoneModalProps) {
  const { toast } = useToast();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();

  const edit = milestoneToEdit ?? null;
  const [title, setTitle] = useState(
    edit ? edit.title : `M${currentMilestoneCount + 1}: `,
  );
  const [targetDate, setTargetDate] = useState(
    edit ? toDateInput(edit.targetDate) : todayInput(),
  );
  const [actualDate, setActualDate] = useState(
    edit ? toDateInput(edit.actualDate) : "",
  );
  const [status, setStatus] = useState<MilestoneStatus>(
    edit?.status ?? "not_started",
  );
  const [order, setOrder] = useState(
    edit ? edit.order || 1 : currentMilestoneCount + 1,
  );
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (title.trim().length < 2) {
      setFormError("Milestone title is required.");
      return;
    }
    if (!targetDate) {
      setFormError("Target date is required.");
      return;
    }
    try {
      if (milestoneToEdit) {
        // Legacy auto-stamps the actual date when a milestone is completed.
        const effectiveActual =
          status === "completed" ? actualDate || todayInput() : actualDate;
        await updateMilestone.mutateAsync({
          milestoneId: milestoneToEdit.id,
          input: {
            title: title.trim(),
            targetDate,
            status,
            order: Number(order) || 1,
            ...(effectiveActual ? { actualDate: effectiveActual } : {}),
          },
        });
        toast({ title: "Milestone updated", variant: "success" });
      } else {
        await createMilestone.mutateAsync({
          projectId,
          input: { title: title.trim(), targetDate, order: Number(order) || 1 },
        });
        toast({ title: "Milestone added", variant: "success" });
      }
      onClose();
    } catch (err) {
      setFormError(errorMessage(err, "Failed to save milestone"));
    }
  }

  const saving = createMilestone.isPending || updateMilestone.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {formError}
        </p>
      ) : null}

      <FormField label="Milestone Title" required>
        {(field) => (
          <Input
            {...field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. M1: Architecture & UI Prototype"
          />
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Target Date" required>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          )}
        </FormField>
        {milestoneToEdit ? (
          <FormField label="Actual Date">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={actualDate}
                onChange={(e) => setActualDate(e.target.value)}
              />
            )}
          </FormField>
        ) : (
          <FormField label="Sequence Order">
            {(field) => (
              <Input
                {...field}
                type="number"
                min="1"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value) || 1)}
              />
            )}
          </FormField>
        )}
      </div>

      {milestoneToEdit ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Status">
            {(field) => (
              <Select
                {...field}
                value={status}
                onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="hold">On Hold</option>
                <option value="completed">Completed</option>
              </Select>
            )}
          </FormField>
          <FormField label="Sequence Order">
            {(field) => (
              <Input
                {...field}
                type="number"
                min="1"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value) || 1)}
              />
            )}
          </FormField>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {milestoneToEdit ? "Update Milestone" : "Add Milestone"}
        </Button>
      </div>
    </form>
  );
}
