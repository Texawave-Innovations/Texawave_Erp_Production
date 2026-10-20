import { useEffect } from "react";
import { toast } from "sonner";

/** Shows a data hook's load error once per distinct message. */
export function useErrorToast(error: string | null | undefined): void {
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);
}
