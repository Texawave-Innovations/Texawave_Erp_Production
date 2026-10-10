"use client";

import { Button, Dialog } from "@texawave-erp/ui-kit";

export interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  itemName: string;
  description?: string;
  loading?: boolean;
}

/**
 * Reusable, accessible delete confirmation dialog.
 * Conforms to Section 10, 44 & Docs/DESIGN_SYSTEM.md.
 */
export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  itemName,
  description,
  loading = false,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          Are you sure you want to delete{" "}
          <strong className="font-semibold text-gray-900 dark:text-white">
            &ldquo;{itemName}&rdquo;
          </strong>
          ? {description ?? "This action cannot be undone."}
        </p>

        <div className="mt-2 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            loading={loading}
          >
            Delete
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
