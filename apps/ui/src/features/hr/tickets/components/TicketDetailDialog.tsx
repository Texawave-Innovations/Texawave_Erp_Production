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
import { Calendar, MessageSquare, Tag } from "lucide-react";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { usePermission } from "@/hooks/usePermission";
import { useAddTicketComment, useSetTicketStatus, useTicket } from "../hooks";
import { createTicketCommentSchema, TICKET_COMMENT_MAX } from "../schema";
import { STATUS_LABELS } from "../status";
import { ADMIN_MOVES, type TicketStatus } from "../types";
import { WRITE_ANY_SCOPE } from "../permissions";
import { formatTicketDateTime, formatTicketId } from "../utils";
import { TicketStatusBadge } from "./TicketStatusBadge";

export interface TicketDetailDialogProps {
  open: boolean;
  onClose: () => void;
  ticketId: number;
  employeeCode?: string | undefined;
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

/**
 * Centered modal displaying complete ticket details, comments thread,
 * status change capabilities, and reply input.
 */
export function TicketDetailDialog({
  open,
  onClose,
  ticketId,
  employeeCode,
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
    <Dialog open={open} onClose={onClose} title="Ticket Details" size="lg">
      {ticket.isPending ? (
        <div className="flex flex-col gap-3 py-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
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
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              View complete information about this ticket.
            </p>
          </div>

          {/* Grid Layout matching reference Panel 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
            {/* Ticket ID */}
            <div>
              <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                Ticket ID
              </span>
              <p className="font-mono text-theme-sm font-semibold text-gray-900 dark:text-white/90 mt-0.5">
                {formatTicketId(ticket.data.id, ticket.data.createdAt)}
              </p>
            </div>

            {/* Status */}
            <div>
              <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                Status
              </span>
              <div className="mt-1">
                <TicketStatusBadge status={ticket.data.status} />
              </div>
            </div>

            {/* Category */}
            <div>
              <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                Category
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 text-theme-sm font-medium text-gray-800 dark:text-gray-200">
                <Tag className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                <span>{ticket.data.category}</span>
              </div>
            </div>

            {/* Subject */}
            <div>
              <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                Subject
              </span>
              <p className="text-theme-sm font-medium text-gray-900 dark:text-white/90 mt-0.5">
                {ticket.data.subject}
              </p>
            </div>

            {/* Created On */}
            <div>
              <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                Created On
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-theme-sm text-gray-800 dark:text-gray-200">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>{formatTicketDateTime(ticket.data.createdAt)}</span>
              </div>
            </div>

            {/* Employee */}
            <div>
              <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                Employee
              </span>
              <div className="mt-1">
                <EmployeeIdentity
                  name={ticket.data.employee.fullName}
                  code={
                    employeeCode ??
                    `EMP-${String(ticket.data.employee.id).padStart(4, "0")}`
                  }
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Description
            </span>
            <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-theme-sm text-gray-800 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-200 min-h-20 whitespace-pre-wrap leading-relaxed">
              {ticket.data.description}
            </div>
          </div>

          {/* Comments & Status Management */}
          <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                Comments & Activity
              </h3>
            </div>

            {ticket.data.comments.length === 0 ? (
              <p className="text-theme-xs text-gray-500 dark:text-gray-400 italic">
                No comments on this ticket yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ticket.data.comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-gray-200 bg-white p-3 text-theme-sm dark:border-gray-700 dark:bg-gray-dark"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-theme-xs text-gray-900 dark:text-white/90">
                        {c.author?.fullName ??
                          (c.authorKind === "HR" ? "HR Admin" : "Employee")}
                      </p>
                      <span className="text-[11px] text-gray-400">
                        {formatTicketDateTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-theme-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {canWrite ? (
              <div className="mt-2 flex flex-col gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                {/* Status move control */}
                {nextStatuses.length > 0 ? (
                  <FormField
                    label="Move to Status"
                    hint="Optional status transition"
                  >
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

                {/* Reply box */}
                <form onSubmit={handleReply} className="flex flex-col gap-2">
                  <FormField
                    label="Post a Reply"
                    hint={`Up to ${TICKET_COMMENT_MAX} characters`}
                    error={replyError ?? undefined}
                  >
                    {(f) => (
                      <Textarea
                        {...f}
                        rows={3}
                        placeholder="Write a reply or update note..."
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
                      className="bg-brand-500 hover:bg-brand-600 text-white font-medium"
                    >
                      Send Reply
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}

            {actionError ? (
              <Alert variant="error" title="Could not save">
                {actionError}
              </Alert>
            ) : null}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
