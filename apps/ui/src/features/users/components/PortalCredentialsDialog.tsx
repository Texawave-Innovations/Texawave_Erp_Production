"use client";

import { Copy } from "lucide-react";
import { Button, Dialog, useToast } from "@texawave-erp/ui-kit";

export interface PortalCredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  /** The platform login e-mail the credentials belong to. */
  username: string;
  /** Plaintext password — shown once, right after generation; the API never
   * returns it again. */
  password: string;
}

/** Shown once, right after an admin creates a portal login or resets a
 * password — the only moment the plaintext password is ever available,
 * since the API stores nothing but its hash. */
export function PortalCredentialsDialog({
  open,
  onClose,
  username,
  password,
}: PortalCredentialsDialogProps) {
  const { toast } = useToast();
  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}/login` : "";

  async function copyCredentials() {
    const text = `Login URL: ${loginUrl}\nUsername: ${username}\nPassword: ${password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Credentials copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy to clipboard", variant: "error" });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Portal access" size="md">
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          This password is shown once. Share it with the employee now — it
          can&apos;t be retrieved again, only reset.
        </p>
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 font-mono text-theme-sm dark:border-slate-700 dark:bg-slate-800/60">
          <div>
            <span className="text-gray-500">Login URL: </span>
            <span className="text-blue-700 dark:text-sky-300">{loginUrl}</span>
          </div>
          <div>
            <span className="text-gray-500">Username: </span>
            <span className="font-semibold">{username}</span>
          </div>
          <div>
            <span className="text-gray-500">Password: </span>
            <span className="font-semibold">{password}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button type="button" onClick={() => void copyCredentials()}>
            <Copy className="h-3.5 w-3.5" />
            Copy credentials
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
