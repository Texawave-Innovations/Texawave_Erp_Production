"use client";

import { type ReactNode } from "react";
import { Dialog, type DialogSize } from "../dialog/index";
import { Button } from "../button/index";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode | string | undefined;
  itemName?: string | undefined;
  confirmText?: string | undefined;
  cancelText?: string | undefined;
  variant?: "primary" | "destructive" | undefined;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
  size?: DialogSize | undefined;
  className?: string | undefined;
  children?: ReactNode | undefined;
}

/**
 * Reusable, accessible ConfirmDialog primitive conforming to TexaOne design system.
 * Supports generic confirmations as well as destructive actions with loading states.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  confirmText,
  cancelText = "Cancel",
  variant = "destructive",
  loading = false,
  disabled = false,
  size = "md",
  className,
  children,
}: ConfirmDialogProps) {
  const resolvedConfirmText =
    confirmText ?? (variant === "destructive" ? "Delete" : "Confirm");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      className={className}
    >
      <div className="flex flex-col gap-4">
        {children ? (
          children
        ) : itemName ? (
          <p className="text-theme-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to{" "}
            {variant === "destructive" ? "delete" : "proceed with"}{" "}
            <strong className="font-semibold text-gray-900 dark:text-white">
              &ldquo;{itemName}&rdquo;
            </strong>
            ? {description ?? "This action cannot be undone."}
          </p>
        ) : description ? (
          typeof description === "string" ? (
            <p className="text-theme-sm text-gray-600 dark:text-gray-300">
              {description}
            </p>
          ) : (
            description
          )
        ) : null}

        <div className="mt-2 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading || disabled}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "primary"}
            onClick={() => void onConfirm()}
            loading={loading}
            disabled={disabled}
          >
            {resolvedConfirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  itemName: string;
  description?: string | undefined;
  loading?: boolean | undefined;
  size?: DialogSize | undefined;
  className?: string | undefined;
}

/**
 * Specialized delete confirmation dialog.
 * Preconfigured convenience wrapper around ConfirmDialog with destructive styling.
 */
export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  itemName,
  description,
  loading = false,
  size = "md",
  className,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      itemName={itemName}
      description={description}
      variant="destructive"
      confirmText="Delete"
      cancelText="Cancel"
      loading={loading}
      size={size}
      className={className}
    />
  );
}
