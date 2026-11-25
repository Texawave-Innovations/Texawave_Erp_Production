"use client";

import { useMemo } from "react";
import {
  resolveErrorMessage,
  resolveFailureMessage,
  resolveMessage,
  type MessageKey,
  type MessageParams,
} from "@texawave-erp/core";
import { useToast } from "@texawave-erp/ui-kit";

/**
 * Fires a toast from the central message catalogue
 * (`packages/core/src/messages/messages.json`) instead of hard-coding text:
 *
 *   notify("sales.document.deleted", { number: inv.invoiceNumber });
 *   notifyError(err, "sales.document.deleteFailed");
 *   notifyFailure(err, "proposals.duplicateFailed");
 *
 * `notifyError` shows the API's message as the toast title (the key is the
 * wording when the API sent none). `notifyFailure` keeps the key's own title
 * and shows the API's message underneath it.
 */
export function useNotify() {
  const { toast } = useToast();
  return useMemo(
    () => ({
      notify: (key: MessageKey, params?: MessageParams) =>
        toast(resolveMessage(key, params)),
      notifyError: (
        error: unknown,
        fallback: MessageKey,
        params?: MessageParams,
      ) => toast(resolveErrorMessage(error, fallback, params)),
      notifyFailure: (
        error: unknown,
        key: MessageKey,
        params?: MessageParams,
      ) => toast(resolveFailureMessage(error, key, params)),
    }),
    [toast],
  );
}
