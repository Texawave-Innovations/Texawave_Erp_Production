import { Button } from "@texawave-erp/ui-kit";

/** Server-side failure of a dialog's action, announced to screen readers. */
export function ServerError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="text-theme-xs text-error-600 dark:text-error-400"
    >
      {message}
    </p>
  );
}

/** Cancel + submit row shared by every payroll dialog form. */
export function DialogActions({
  onCancel,
  submitting,
  submitLabel,
  destructive = false,
}: {
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onCancel}
        disabled={submitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        variant={destructive ? "destructive" : "primary"}
        loading={submitting}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
