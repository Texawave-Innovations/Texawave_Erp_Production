"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  ErrorState,
  FormField,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAddTicketComment, useSetTicketStatus, useTicket } from "../hooks";
import { createTicketCommentSchema, TICKET_COMMENT_MAX } from "../schema";
import { STATUS_LABELS } from "../status";
import { ADMIN_MOVES, type TicketStatus } from "../types";
import { WRITE_ANY_SCOPE } from "../permissions";
import { TicketStatusBadge } from "./TicketStatusBadge";

export interface TicketDetailDialogProps {
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
      return "This ticket is no longer in your scope.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This status change is no longer allowed for the ticket's current state.";
    }
    if (error.errorCode === "TICKET_NOT_ACTIVE") {
      return "Replies are accepted only while the ticket is open or in progress.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the fields and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Ticket detail: comments thread (oldest first), a reply box and a
 * status-change control, gated on hr.ticket.write. */
export function TicketDetailDialog({
  open,
  onClose,
  ticketId,
}: TicketDetailDialogProps) {
  const canWrite = usePermission(WRITE_ANY_SCOPE);
  const ticket = useTicket(ticketId);
  const setStatus = useSetTicketStatus();
  const addComment = useAddTicketComment();
  const { toast } = useToast();

  const [status, setStatusValue] = useState<"" | TicketStatus>("");
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const submitting = setStatus.isPending || addComment.isPending;

  async function handleStatusChange() {
    if (!status) return;
    setActionError(null);
    try {
      await setStatus.mutateAsync({ id: ticketId, status });
      toast({ title: "Ticket status updated", variant: "success" });
      setStatusValue("");
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

  const nextStatuses = ticket.data ? ADMIN_MOVES[ticket.data.status] : [];

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
          <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-theme-sm dark:bg-gray-800">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-gray-900 dark:text-white/90">
                {ticket.data.subject}
              </p>
              <TicketStatusBadge status={ticket.data.status} />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {ticket.data.employee.fullName} · {ticket.data.category}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              {ticket.data.description}
            </p>
          </div>

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
                        (c.authorKind === "HR" ? "HR" : "Employee")}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canWrite ? (
            <>
              {nextStatuses.length > 0 ? (
                <FormField label="Move to status" hint="Optional.">
                  {(f) => (
                    <div className="flex gap-2">
                      <Select
                        {...f}
                        value={status}
                        disabled={submitting}
                        onChange={(e) =>
                          setStatusValue(e.target.value as "" | TicketStatus)
                        }
                      >
                        <option value="">No status change</option>
                        {nextStatuses.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!status}
                        loading={setStatus.isPending}
                        onClick={() => void handleStatusChange()}
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                </FormField>
              ) : null}

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
                      disabled={submitting}
                      onChange={(e) => setReply(e.target.value)}
                    />
                  )}
                </FormField>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    loading={addComment.isPending}
                  >
                    Send reply
                  </Button>
                </div>
              </form>
            </>
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
