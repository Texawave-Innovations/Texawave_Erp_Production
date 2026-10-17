"use client";

import { useState } from "react";
import { z } from "zod";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DatePicker,
  Dialog,
  FormField,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import { todayIst } from "../format";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date."),
});

/** A document action that only needs a date (e.g. "Move to tax invoice",
 * "Create delivery challan"): pick it (default today) and confirm. */
export function DateActionDialog({
  open,
  onClose,
  title,
  dateLabel,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  dateLabel: string;
  description: string;
  confirmLabel: string;
  onConfirm: (date: string) => Promise<void>;
}) {
  const [values, setValues] = useState({ date: todayIst() });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { errorFor, touch, validateAll } = useFormValidation(schema, values);

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    const v = validateAll();
    if (!v) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(v.date);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <form onSubmit={handleConfirm} className="flex flex-col gap-4" noValidate>
        {error ? (
          <Alert variant="error" title="Not done">
            {error}
          </Alert>
        ) : null}
        <FormField
          label={dateLabel}
          required
          errorVariant="bubble"
          error={errorFor("date")}
        >
          {(f) => (
            <DatePicker
              {...f}
              value={values.date}
              onBlur={() => touch("date")}
              onChange={(e) => setValues({ date: e.target.value })}
            />
          )}
        </FormField>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
