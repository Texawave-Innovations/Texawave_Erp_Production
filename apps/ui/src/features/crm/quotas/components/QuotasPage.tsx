"use client";

import type { CrmQuota } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { Button } from "@/components/legacy-ui/button";
import { Card, CardContent } from "@/components/legacy-ui/card";
import { celebrateCrm } from "@/features/crm/celebration";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import { EmptyState } from "@/features/crm/legacy-ui/CrmCommon";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatMultiCurrencyTotal } from "../format";
import {
  useCreateQuota,
  useDeleteQuota,
  useQuotas,
  useUpdateQuota,
} from "../hooks";
import { QuotaCard } from "./QuotaCard";
import { QuotaDetail } from "./QuotaDetail";
import { QuotaForm } from "./QuotaForm";

type Mode =
  | { kind: "list" }
  | { kind: "view"; id: number }
  | { kind: "form"; editing: CrmQuota | null };

/** Quotas / Sales Targets — legacy Quotas.tsx. Three tiers (see
 * quotas.controller.ts): `crm.quota.read` sees every rep's target + team
 * totals, `.write` adds Set Target / Edit, `.delete` adds Delete. */
export function QuotasPage() {
  const canManage = usePermission("crm.quota.write");
  const canDelete = usePermission("crm.quota.delete");
  const currentUser = useAuthStore((s) => s.user?.fullName) ?? "";
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  const query = useQuotas({ limit: 100 });
  const createQuota = useCreateQuota();
  const updateQuota = useUpdateQuota();
  const deleteQuota = useDeleteQuota();

  const quotas = useMemo(() => query.data?.data ?? [], [query.data]);
  const knownReps = useMemo(
    () => [...new Set(quotas.map((q) => q.repName.trim()))].sort(),
    [quotas],
  );

  const totals = useMemo(() => {
    const target = formatMultiCurrencyTotal(
      quotas.map((q) => ({ amount: q.targetAmount, currency: q.currency })),
    );
    const attained = formatMultiCurrencyTotal(
      quotas.map((q) => ({ amount: q.live.achieved, currency: q.currency })),
    );
    const currencies = new Set(quotas.map((q) => q.currency || "INR"));
    let pct: number | null = 0;
    if (currencies.size <= 1) {
      const t = quotas.reduce((s, q) => s + q.targetAmount, 0);
      const a = quotas.reduce((s, q) => s + q.live.achieved, 0);
      pct = t > 0 ? Math.round((a / t) * 100) : 0;
    } else {
      pct = null;
    }
    return { target, attained, pct };
  }, [quotas]);

  if (mode.kind === "view") {
    const quota = quotas.find((q) => q.id === mode.id);
    if (quota) {
      return (
        <QuotaDetail
          quota={quota}
          canManage={canManage}
          onBack={() => setMode({ kind: "list" })}
          onEdit={() => setMode({ kind: "form", editing: quota })}
        />
      );
    }
  }

  if (mode.kind === "form") {
    return (
      <QuotaForm
        editing={mode.editing}
        currentUser={currentUser}
        knownReps={knownReps}
        canManage={canManage}
        onCancel={() => setMode({ kind: "list" })}
        onSubmit={async (values, id) => {
          if (id === null) {
            await createQuota.mutateAsync(values);
            toast.success("Quota created");
            celebrateCrm("quota.created");
          } else {
            await updateQuota.mutateAsync({ id, input: values });
            toast.success("Quota updated");
            celebrateCrm("quota.updated");
          }
          setMode({ kind: "list" });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <div className="crm-panel-frame crm-panel-header relative overflow-hidden bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex items-center justify-between gap-3 flex-wrap rounded-3xl px-5 py-4">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-100">
            <Target className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Quotas / Sales Targets
            </h2>
            <p className="text-sm text-slate-500">
              Team targets and attainment.
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            size="sm"
            className="relative rounded-xl gap-1.5"
            onClick={() => setMode({ kind: "form", editing: null })}
          >
            <Plus className="h-4 w-4" /> Set Target
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Team Target", totals.target],
          ["Team Closed Won", totals.attained],
          ["Team Attainment", totals.pct === null ? "Mixed" : `${totals.pct}%`],
        ].map(([label, value]) => (
          <Card key={label} className="crm-panel-frame rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase text-black">{label}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {query.isPending ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          Loading Quotas…
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <EmptyState
            icon={Target}
            title="You don't have access to Quotas"
            description="Ask an administrator for the crm.quota.read permission."
          />
        ) : (
          <div className="text-center py-16 text-xs text-red-500">
            Could not load quotas.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void query.refetch()}
            >
              Retry
            </button>
          </div>
        )
      ) : quotas.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No quotas set yet"
          description={
            canManage
              ? "Set a monthly or quarterly target for a rep to start tracking attainment."
              : "Ask a CRM Admin / Sales Head to set a target for a rep."
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quotas.map((q) => (
            <QuotaCard
              key={q.id}
              quota={q}
              canManage={canManage}
              canDelete={canDelete}
              onView={() => setMode({ kind: "view", id: q.id })}
              onEdit={() => setMode({ kind: "form", editing: q })}
              onDelete={() =>
                deleteQuota.mutateAsync(q.id).then(
                  () => {
                    toast.success("Quota removed");
                  },
                  () => {
                    toast.error("Failed to remove quota");
                  },
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
