"use client";

import type { Packing, PackingPayload, Picking } from "@texawave-erp/api-types";
import { PACK_STATUSES } from "@texawave-erp/api-types";
import {
  Button,
  Input,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { Package, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDateTime,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { useMasterListItems } from "../../master-list-items/hooks";
import { ScmDetailDialog } from "../../shared/ScmDetailDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreatePacking,
  useDeletePacking,
  usePackingAction,
  usePackings,
  usePickings,
} from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
/** Legacy `ScmPacking`: pack completed picks into numbered packages. */
export function PackingsView() {
  const c = useListControls();
  const [status, setStatus] = useState("");
  const [packing, setPacking] = useState<Picking | null>(null);
  const [viewing, setViewing] = useState<Packing | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.fulfillment.write");
  const deletingRowRemove = useDeletePacking();
  const [deletingRow, setDeletingRow] = useState<Packing | null>(null);
  const create = useCreatePacking();
  const act = usePackingAction();
  const packable = usePickings({ page: 1, limit: 50, packable: "true" });
  const query = usePackings({
    page: c.page,
    limit: c.pageSize,
    q: c.q,
    status: status || undefined,
  });

  return (
    <ScmListView<Packing>
      title="Packing"
      description="Pack completed pick lists into packages ready for shipment."
      icon={Package}
      noun="packings"
      readPermission="scm.fulfillment.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={setViewing}
      summary={
        canWrite && (packable.data?.data.length ?? 0) > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-dark">
            <span className="text-theme-sm text-gray-600 dark:text-gray-300">
              Ready to pack:
            </span>
            {packable.data?.data.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant="secondary"
                className="gap-1"
                onClick={() => setPacking(p)}
              >
                <Plus className="h-3.5 w-3.5" />
                {p.pickNumber}
              </Button>
            ))}
          </div>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by pack number or order...",
      }}
      filters={
        <div className="w-full lg:w-44">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              c.setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {PACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
      }
      hasActiveFilters={Boolean(c.search || status)}
      onResetFilters={() => {
        c.setSearch("");
        setStatus("");
      }}
      emptyTitle="Nothing packed yet"
      emptyDescription="Complete a pick list, then pack it here."
      columns={[
        {
          header: "Pack #",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.packNumber}</span>
          ),
        },
        { header: "Pick List", cell: (r) => r.picking?.pickNumber ?? "—" },
        { header: "Sales Order", cell: (r) => r.salesOrderNumber },
        { header: "Packages", align: "right", cell: (r) => r.packages.length },
        { header: "Packer", cell: (r) => r.packerName ?? "—" },
        { header: "Completed", cell: (r) => formatDateTime(r.completedAt) },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={formatStatusLabel(r.status)}
              colorToken={scmStatusToken(r.status)}
            />
          ),
        },
        {
          header: "",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) =>
            canWrite ? (
              <div
                className="flex justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <ScmDeleteButton
                  label="Delete packing"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<Packing>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete packing?"
        describe={(r) =>
          `Permanently delete ${r.packNumber}? This cannot be undone. A packing already linked to order fulfillment cannot be deleted.`
        }
        confirmText="Delete packing"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Packing deleted"
        errorFallback="Failed to delete packing"
      />
      <PackDialog
        picking={packing}
        onClose={() => setPacking(null)}
        onSubmit={async (payload) => {
          try {
            await create.mutateAsync(payload);
          } catch (err) {
            throw new Error(errorText(err, "Failed to save packing"));
          }
          toast({ title: "Packing completed", variant: "success" });
          setPacking(null);
        }}
      />
      <ScmDetailDialog
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.packNumber ?? "Packing"}
        status={viewing?.status ?? ""}
        fields={[
          ["Pick list", viewing?.picking?.pickNumber],
          ["Sales order", viewing?.salesOrderNumber],
          ["Fulfillment", viewing?.fulfillment?.fulfillmentNumber],
          ["Packer", viewing?.packerName],
          ["Completed", formatDateTime(viewing?.completedAt)],
          ["Notes", viewing?.notes],
        ]}
        lineRows={viewing?.packages ?? []}
        getLineKey={(p) => String(p.id)}
        lineCaption="Packages"
        lineColumns={[
          { header: "Package #", cell: (p) => p.packageNumber },
          { header: "Type", cell: (p) => p.packageType ?? "—" },
          {
            header: "Weight",
            align: "right",
            cell: (p) => (p.weight ? formatQty(p.weight) : "—"),
          },
          {
            header: "Units",
            align: "right",
            cell: (p) =>
              formatQty(p.items.reduce((s, i) => s + Number(i.quantity), 0)),
          },
        ]}
        footer={
          canWrite &&
          (viewing?.status === "PACKED" ||
            viewing?.status === "IN_PROGRESS") ? (
            <div className="flex justify-end gap-2">
              {viewing.status === "IN_PROGRESS" ? (
                <Button
                  onClick={async () => {
                    try {
                      await act.mutateAsync({
                        id: viewing.id,
                        action: "pack",
                      });
                      toast({ title: "Packing completed", variant: "success" });
                      setViewing(null);
                    } catch (err) {
                      toast({
                        title: errorText(err, "Failed to complete packing"),
                        variant: "error",
                      });
                    }
                  }}
                >
                  Mark as Packed
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await act.mutateAsync({ id: viewing.id, action: "cancel" });
                    toast({ title: "Packing cancelled", variant: "success" });
                    setViewing(null);
                  } catch (err) {
                    toast({
                      title: errorText(err, "Failed to cancel packing"),
                      variant: "error",
                    });
                  }
                }}
              >
                Cancel Packing
              </Button>
            </div>
          ) : null
        }
      />
    </ScmListView>
  );
}

interface PackageDraft {
  packageNumber: string;
  packageType: string;
  weight: string;
  qty: Record<number, string>;
}

function PackDialog({
  picking,
  onClose,
  onSubmit,
}: {
  picking: Picking | null;
  onClose: () => void;
  onSubmit: (payload: PackingPayload) => Promise<void>;
}) {
  return (
    <ScmPanel
      open={picking !== null}
      onClose={onClose}
      title={`Pack ${picking?.pickNumber ?? ""}`}
      size="2xl"
    >
      {picking ? (
        <PackBody
          key={picking.id}
          picking={picking}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </ScmPanel>
  );
}

function PackBody({
  picking,
  onClose,
  onSubmit,
}: {
  picking: Picking;
  onClose: () => void;
  onSubmit: (payload: PackingPayload) => Promise<void>;
}) {
  const [packer, setPacker] = useState("");
  const [packages, setPackages] = useState<PackageDraft[]>([
    {
      packageNumber: "PKG-1",
      packageType: "",
      weight: "",
      qty: Object.fromEntries(
        picking.items.map((i) => [
          i.productId,
          String(Number(i.pickedQuantity)),
        ]),
      ),
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const packageTypes = useMasterListItems({
    category: "package_type",
    page: 1,
    limit: 100,
  });
  const packageTypeOptions = packageTypes.data?.data ?? [];

  const patch = (idx: number, next: Partial<PackageDraft>) =>
    setPackages((p) => p.map((x, i) => (i === idx ? { ...x, ...next } : x)));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const out: PackingPayload["packages"] = [];
    const totals = new Map<number, number>();
    for (const p of packages) {
      const items = picking.items
        .map((i) => ({
          productId: i.productId,
          quantity: Number(p.qty[i.productId] || 0),
        }))
        .filter((i) => i.quantity > 0);
      if (items.length === 0) continue;
      for (const i of items)
        totals.set(i.productId, (totals.get(i.productId) ?? 0) + i.quantity);
      out.push({
        packageNumber: p.packageNumber.trim(),
        packageType: p.packageType.trim() || undefined,
        weight: p.weight ? Number(p.weight) : undefined,
        items,
      });
    }
    if (out.length === 0) return setError("Put at least one item in a package");
    if (out.some((p) => !p.packageNumber))
      return setError("Every package needs a number");
    for (const i of picking.items) {
      if ((totals.get(i.productId) ?? 0) > Number(i.pickedQuantity))
        return setError(
          `${i.productName}: packed more than the ${formatQty(i.pickedQuantity)} picked`,
        );
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        pickingId: picking.id,
        packerName: packer.trim() || undefined,
        packages: out,
      });
    } catch (err) {
      setError(errorText(err, "Failed to save packing"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input
        aria-label="Packer name"
        placeholder="Packer name (optional)"
        value={packer}
        onChange={(e) => setPacker(e.target.value)}
      />
      {packages.map((p, idx) => (
        <div
          key={idx}
          className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_8rem_auto]">
            <Input
              aria-label={`Package ${idx + 1} number`}
              placeholder="Package number"
              value={p.packageNumber}
              onChange={(e) => patch(idx, { packageNumber: e.target.value })}
            />
            <Select
              aria-label={`Package ${idx + 1} type`}
              value={p.packageType}
              onChange={(e) => patch(idx, { packageType: e.target.value })}
            >
              <option value="">Select a type</option>
              {packageTypeOptions.map((t) => (
                <option key={t.id} value={t.value}>
                  {t.value}
                </option>
              ))}
            </Select>
            <Input
              aria-label={`Package ${idx + 1} weight`}
              type="number"
              min={0}
              step={0.01}
              placeholder="Weight"
              value={p.weight}
              onChange={(e) => patch(idx, { weight: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove package ${idx + 1}`}
              disabled={packages.length === 1}
              onClick={() => setPackages((x) => x.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {picking.items.map((i) => (
            <div
              key={i.id}
              className="grid grid-cols-[1fr_8rem] items-center gap-3"
            >
              <span className="text-theme-sm">
                {i.productName}{" "}
                <span className="text-gray-500">
                  (picked {formatQty(i.pickedQuantity)})
                </span>
              </span>
              <Input
                type="number"
                min={0}
                step={0.001}
                aria-label={`${i.productName} quantity in package ${idx + 1}`}
                value={p.qty[i.productId] ?? ""}
                onChange={(e) =>
                  patch(idx, {
                    qty: { ...p.qty, [i.productId]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1"
          onClick={() =>
            setPackages((x) => [
              ...x,
              {
                packageNumber: `PKG-${x.length + 1}`,
                packageType: "",
                weight: "",
                qty: {},
              },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Add Package
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Complete Packing
        </Button>
      </div>
    </form>
  );
}
