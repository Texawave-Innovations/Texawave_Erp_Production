"use client";

import { useState } from "react";
import { z } from "zod";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import { sendEmail } from "../documents";

const emails = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "" ||
      v
        .split(",")
        .map((e) => e.trim())
        .every((e) => z.string().email().safeParse(e).success),
    { message: "Enter email addresses separated by commas." },
  );

const schema = z.object({
  to: emails,
  cc: emails,
  subject: z.string().trim().max(200, "Must be at most 200 characters."),
  message: z.string().max(5000, "Must be at most 5000 characters."),
});

const list = (v: string) =>
  v
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

/**
 * "Send Email" for any Sales document: the PDF is attached by the server.
 * Blank "To" sends to the customer's email; blank subject/message use the
 * standard text.
 */
export function SendEmailDialog({
  open,
  onClose,
  path,
  documentLabel,
  customerEmail,
}: {
  open: boolean;
  onClose: () => void;
  /** e.g. `/sales/quotations/12/email`. */
  path: string;
  /** e.g. "Quotation TW/QUO/26-27/0001". */
  documentLabel: string;
  customerEmail: string;
}) {
  const { toast } = useToast();
  const [values, setValues] = useState({
    to: "",
    cc: "",
    subject: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { errorFor, touch, validateAll } = useFormValidation(schema, values);
  const set = (k: keyof typeof values, v: string) =>
    setValues((s) => ({ ...s, [k]: v }));

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!validateAll()) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendEmail(path, {
        ...(values.to ? { to: list(values.to) } : {}),
        ...(values.cc ? { cc: list(values.cc) } : {}),
        ...(values.subject.trim() ? { subject: values.subject.trim() } : {}),
        ...(values.message.trim() ? { message: values.message } : {}),
      });
      toast(
        result.status === "SENT"
          ? { title: `Emailed to ${result.to.join(", ")}`, variant: "success" }
          : {
              title: "Email is not set up on the server",
              description:
                "Nothing was sent. Ask an administrator to configure SMTP.",
              variant: "warning",
            },
      );
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send the email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Email ${documentLabel}`}
      size="lg"
    >
      <form onSubmit={handleSend} className="flex flex-col gap-4" noValidate>
        {error ? (
          <Alert variant="error" title="Not sent">
            {error}
          </Alert>
        ) : null}
        <FormField
          label="To"
          errorVariant="bubble"
          error={errorFor("to")}
          hint={`Blank sends to the customer: ${customerEmail}`}
        >
          {(f) => (
            <Input
              {...f}
              placeholder={customerEmail}
              value={values.to}
              onBlur={() => touch("to")}
              onChange={(e) => set("to", e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Cc" errorVariant="bubble" error={errorFor("cc")}>
          {(f) => (
            <Input
              {...f}
              value={values.cc}
              onBlur={() => touch("cc")}
              onChange={(e) => set("cc", e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Subject"
          errorVariant="bubble"
          error={errorFor("subject")}
        >
          {(f) => (
            <Input
              {...f}
              placeholder={documentLabel}
              value={values.subject}
              onBlur={() => touch("subject")}
              onChange={(e) => set("subject", e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Message"
          errorVariant="bubble"
          error={errorFor("message")}
          hint="Blank uses the standard message."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={5}
              value={values.message}
              onBlur={() => touch("message")}
              onChange={(e) => set("message", e.target.value)}
            />
          )}
        </FormField>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={sending}>
            Send
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
