import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "./format";

/** Busy flag + toast wrapper for detail-page actions: runs `fn`, toasts success or the error
 *  message, and calls `onSuccess` (typically a reload) afterwards. */
export function useAsyncAction(onSuccess?: () => void) {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (
      fn: () => Promise<unknown>,
      successMsg: string,
    ): Promise<boolean> => {
      setBusy(true);
      try {
        await fn();
        toast.success(successMsg);
        onSuccess?.();
        return true;
      } catch (err) {
        toast.error(errorMessage(err, "Action failed"));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onSuccess],
  );

  return { busy, run };
}

/** Loads data once on mount (and on `reload`), exposing `error` instead of silently returning
 *  empty data when a read fails. */
export function useAsyncData<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
