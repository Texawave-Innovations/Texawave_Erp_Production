"use client";

import { Button } from "@texawave-erp/ui-kit";

export interface AssignModalActionsProps {
  saveLabel: string;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/** Cancel / Save footer shared by the Assign* modals. */
export function AssignModalActions({
  saveLabel,
  saving,
  onCancel,
  onSave,
}: AssignModalActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </Button>
      <Button type="button" loading={saving} onClick={onSave}>
        {saveLabel}
      </Button>
    </div>
  );
}
