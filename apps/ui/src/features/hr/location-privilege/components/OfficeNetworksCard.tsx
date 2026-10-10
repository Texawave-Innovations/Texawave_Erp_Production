"use client";

import { useState } from "react";
import { Network, Plus, Power, Server } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
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
    <Card className="p-5">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-theme-base font-bold tracking-tight text-gray-900 dark:text-white">
              Office networks
            </h2>
            {query.data ? (
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-semibold text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                {query.data.length} configured
              </span>
            ) : null}
          </div>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Configured office network IP addresses and subnets for attendance
            check-ins.
          </p>
        </div>

        {canWrite ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 shadow-2xs text-theme-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            Add address
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        {query.isPending ? (
          <TableSkeleton rowsCount={3} columnsCount={4} />
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
            action={
              canWrite ? (
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add address
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable<OfficeNetwork>
            caption="Office networks"
            rows={query.data}
            getRowKey={(n) => String(n.id)}
            columns={[
              {
                header: "IP address",
                cell: (n) => (
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    <span className="font-mono text-theme-xs font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/80 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                      {n.ipAddress}
                    </span>
                  </div>
                ),
              },
              {
                header: "Label",
                cell: (n) => (
                  <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">
                    {n.label ?? "—"}
                  </span>
                ),
              },
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
                      className={`text-theme-xs font-medium inline-flex items-center gap-1 h-8 px-2.5 ${
                        n.isActive
                          ? "text-gray-600 hover:text-error-600 dark:text-gray-400 dark:hover:text-error-400"
                          : "text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      }`}
                    >
                      <Power className="h-3 w-3" />
                      {n.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </div>

      {/* Add Address Modal */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setFormError(null);
        }}
        title="Add office network address"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 -mt-1">
            Register a trusted public IP address for office network attendance
            validation.
          </p>

          {formError ? (
            <Alert variant="error" title="Could not add address">
              {formError}
            </Alert>
          ) : null}

          <FormField
            label="IP address"
            required
            hint="IPv4 or IPv6 public gateway address (e.g. 203.0.113.10)"
          >
            {(f) => (
              <Input
                {...f}
                aria-label="IP address"
                placeholder="203.0.113.10"
                value={ipAddress}
                disabled={addMutation.isPending}
                onChange={(e) => {
                  setIpAddress(e.target.value);
                  setFormError(null);
                }}
              />
            )}
          </FormField>

          <FormField
            label="Label"
            hint="Friendly name for this office router or location (optional)"
          >
            {(f) => (
              <Input
                {...f}
                aria-label="Label"
                placeholder="Head office router (optional)"
                value={label}
                disabled={addMutation.isPending}
                onChange={(e) => setLabel(e.target.value)}
              />
            )}
          </FormField>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreateOpen(false);
                setFormError(null);
              }}
              disabled={addMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={addMutation.isPending}
              loading={addMutation.isPending}
            >
              Add address
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
