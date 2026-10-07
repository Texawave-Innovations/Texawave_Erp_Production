"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  useAddOfficeNetwork,
  useOfficeNetworks,
  useSetOfficeNetworkActive,
} from "../hooks";
import { OFFICE_NETWORK_READ, OFFICE_NETWORK_WRITE } from "../permissions";
import type { OfficeNetwork } from "../types";

/** Organization-wide IP allowlist used by OFFICE-mode employees' punches. */
export function OfficeNetworksCard() {
  const [createOpen, setCreateOpen] = useState(false);
  const [ipAddress, setIpAddress] = useState("");
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { toast } = useToast();

  const canRead = usePermission(OFFICE_NETWORK_READ);
  const canWrite = usePermission(OFFICE_NETWORK_WRITE);

  const query = useOfficeNetworks(canRead);
  const addMutation = useAddOfficeNetwork();
  const toggleMutation = useSetOfficeNetworkActive();

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to office networks">
        Ask an administrator for the <code>hr.office_network.read</code>{" "}
        permission.
      </Alert>
    );
  }

  async function handleCreate() {
    setFormError(null);
    if (!ipAddress.trim()) {
      setFormError("IP address is required");
      return;
    }
    try {
      await addMutation.mutateAsync({
        ipAddress: ipAddress.trim(),
        ...(label.trim() ? { label: label.trim() } : {}),
      });
      setCreateOpen(false);
      setIpAddress("");
      setLabel("");
      toast({ title: "Office network added", variant: "success" });
    } catch (error) {
      if (error instanceof ApiError && error.isValidationError) {
        setFormError(error.message || "Enter a valid IP address");
      } else {
        toast({ title: "Could not add office network", variant: "error" });
      }
    }
  }

  async function handleToggle(network: OfficeNetwork) {
    try {
      await toggleMutation.mutateAsync({
        id: network.id,
        isActive: !network.isActive,
      });
      toast({
        title: network.isActive ? "Address deactivated" : "Address activated",
        variant: "success",
      });
    } catch {
      toast({ title: "Could not update address", variant: "error" });
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Office networks
        </h2>
        {canWrite ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            Add address
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        {query.isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState
            title="No office networks yet"
            description={
              canWrite
                ? "Add the first office address to restrict OFFICE-mode punches."
                : "Office addresses will appear here once configured."
            }
          />
        ) : (
          <DataTable<OfficeNetwork>
            caption="Office networks"
            rows={query.data}
            getRowKey={(n) => String(n.id)}
            columns={[
              { header: "IP address", cell: (n) => n.ipAddress },
              { header: "Label", cell: (n) => n.label ?? "—" },
              {
                header: "Status",
                cell: (n) => (
                  <StatusBadge
                    label={n.isActive ? "Active" : "Inactive"}
                    colorToken={n.isActive ? "success" : "gray"}
                  />
                ),
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (n) =>
                  canWrite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleToggle(n)}
                      aria-label={`${n.isActive ? "Deactivate" : "Activate"} ${n.ipAddress}`}
                    >
                      {n.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add office network address"
      >
        <div className="flex flex-col gap-4">
          {formError ? (
            <Alert variant="error" title="Could not add address">
              {formError}
            </Alert>
          ) : null}
          <Input
            aria-label="IP address"
            placeholder="203.0.113.10"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
          />
          <Input
            aria-label="Label"
            placeholder="Head office router (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={addMutation.isPending}
            >
              Add address
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
