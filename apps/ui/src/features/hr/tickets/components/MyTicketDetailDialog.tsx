"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  useAddMyTicketComment,
  useMyTicket,
  useUpdateMyTicket,
} from "../hooks";
import { SELF_SERVICE_UPDATE } from "../permissions";
import {
  createMyTicketSchema,
  createTicketCommentSchema,
  TICKET_COMMENT_MAX,
  TICKET_DESCRIPTION_MAX,
  TICKET_SUBJECT_MAX,
} from "../schema";
import { EMPLOYEE_TICKET_CATEGORIES, type TicketCategory } from "../types";
import { TicketStatusBadge } from "./TicketStatusBadge";

export interface MyTicketDetailDialogProps {
  open: boolean;
  onClose: () => void;
  ticketId: number;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to manage this ticket.";
    }
    if (error.statusCode === 404) {
      return "This ticket is no longer yours to view.";
    }
    if (error.errorCode === "ADMIN_RAISED_TICKET_NOT_EDITABLE") {
      return "A ticket raised by HR cannot be edited.";
    }
    if (error.errorCode === "TICKET_NOT_EDITABLE") {
      return "Only an open ticket can be edited.";
    }
    if (error.errorCode === "CATEGORY_NOT_ALLOWED") {
      return "That category can only be raised by HR.";
    }
    if (error.errorCode === "REPLY_NOT_ALLOWED") {
      return "Only a ticket raised by HR takes a reply.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the fields and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/**
 * My ticket detail (legacy `RaiseTicket.tsx` View/Edit modal): the ticket,
 * its comments thread, an edit toggle for an open self-raised ticket, and a
 * reply box for a ticket HR raised for me.
 */
export function MyTicketDetailDialog({
  open,
  onClose,
  ticketId,
}: MyTicketDetailDialogProps) {
  const canUpdate = usePermission(SELF_SERVICE_UPDATE);
  const ticket = useMyTicket(ticketId);
  const update = useUpdateMyTicket();
  const addComment = useAddMyTicketComment();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    category: "" as unknown as TicketCategory,
    subject: "",
    description: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function startEdit() {
    if (!ticket.data) return;
    setEditValues({
      category: ticket.data.category,
      subject: ticket.data.subject,
      description: ticket.data.description,
    });
    setEditErrors({});
    setActionError(null);
    setEditing(true);
  }

  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    const result = createMyTicketSchema.safeParse(editValues);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key])
          errors[key] = issue.message;
      }
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    setActionError(null);
    try {
      await update.mutateAsync({ id: ticketId, body: result.data });
      toast({ title: "Ticket updated", variant: "success" });
      setEditing(false);
    } catch (err) {
      setActionError(describeError(err));
    }
  }

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    const result = createTicketCommentSchema.safeParse({ body: reply });
    if (!result.success) {
      setReplyError(result.error.issues[0]?.message ?? "Invalid value");
      return;
    }
    setReplyError(null);
    setActionError(null);
    try {
      await addComment.mutateAsync({ id: ticketId, body: result.data.body });
      setReply("");
      toast({ title: "Reply sent", variant: "success" });
    } catch (err) {
      setActionError(describeError(err));
    }
  }

  const canEdit =
    canUpdate &&
    !!ticket.data &&
    !ticket.data.raisedByAdmin &&
    ticket.data.status === "OPEN";
  const canReply = canUpdate && !!ticket.data && ticket.data.raisedByAdmin;

  return (
    <Dialog open={open} onClose={onClose} title="Ticket">
      {ticket.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : ticket.isError ? (
        ticket.error instanceof ApiError && ticket.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to this ticket">
            Your access to this ticket has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void ticket.refetch()} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {editing ? (
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <FormField label="Category" error={editErrors.category}>
                {(f) => (
                  <Select
                    {...f}
                    invalid={f.invalid}
                    value={editValues.category}
                    disabled={update.isPending}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        category: e.target.value as TicketCategory,
                      }))
                    }
                  >
                    {EMPLOYEE_TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField
                label="Subject"
                error={editErrors.subject}
                hint={`Up to ${TICKET_SUBJECT_MAX} characters`}
              >
                {(f) => (
                  <Input
                    {...f}
                    invalid={f.invalid}
                    value={editValues.subject}
                    disabled={update.isPending}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, subject: e.target.value }))
                    }
                  />
                )}
              </FormField>
              <FormField
                label="Description"
                error={editErrors.description}
                hint={`Up to ${TICKET_DESCRIPTION_MAX} characters`}
              >
                {(f) => (
                  <Textarea
                    {...f}
                    rows={4}
                    invalid={f.invalid}
                    value={editValues.description}
                    disabled={update.isPending}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        description: e.target.value,
                      }))
                    }
                  />
                )}
              </FormField>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(false)}
                  disabled={update.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={update.isPending}>
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-theme-sm dark:bg-gray-800">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-gray-900 dark:text-white/90">
                  {ticket.data.subject}
                </p>
                <TicketStatusBadge status={ticket.data.status} />
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {ticket.data.category} ·{" "}
                {ticket.data.raisedByAdmin ? "Raised by HR" : "Raised by me"}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                {ticket.data.description}
              </p>
              {canEdit ? (
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={startEdit}>
                    Edit
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Comments
            </h3>
            {ticket.data.comments.length === 0 ? (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                No comments yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ticket.data.comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-gray-200 p-2 text-theme-sm dark:border-gray-800"
                  >
                    <p className="font-medium text-gray-900 dark:text-white/90">
                      {c.author?.fullName ??
                        (c.authorKind === "HR" ? "HR" : "Me")}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canReply ? (
            <form onSubmit={handleReply} className="flex flex-col gap-2">
              <FormField
                label="Reply"
                hint={`Up to ${TICKET_COMMENT_MAX} characters`}
                error={replyError ?? undefined}
              >
                {(f) => (
                  <Textarea
                    {...f}
                    rows={3}
                    invalid={f.invalid}
                    value={reply}
                    disabled={addComment.isPending}
                    onChange={(e) => setReply(e.target.value)}
                  />
                )}
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={addComment.isPending}>
                  Send reply
                </Button>
              </div>
            </form>
          ) : null}

          {actionError ? (
            <Alert variant="error" title="Could not save">
              {actionError}
            </Alert>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
