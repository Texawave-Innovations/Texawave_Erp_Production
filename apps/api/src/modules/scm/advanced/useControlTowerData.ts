// Shared data hook for every Advanced SCM page (and the Overview summary): the shared, cached
// `useScmReportsData()` dataset feeds the deterministic exception and replenishment engines, and
// the results are reconciled into `scm/advanced/*` at most once per `RECONCILE_INTERVAL_MS` per
// browser session (or on an explicit Refresh) — never on every page mount.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useScmReportsData } from "../reports/reportService";
import { actorName } from "../shared/actor";
import { errorMessage } from "../shared/format";
import { evaluateExceptions } from "./exceptionEngine";
import { computeReplenishmentRecommendations } from "./replenishmentService";
import {
  reconcileExceptions,
  reconcileReplenishment,
} from "./scmAutomationService";
import type {
  ReplenishmentRecommendation,
  ScmException,
} from "./advancedTypes";

const RECONCILE_INTERVAL_MS = 5 * 60_000;

// Module-level so every page/component using the hook shares one throttle.
let lastReconcileAt = 0;
let reconcileInFlight: Promise<string | null> | null = null;
let forceNextReconcile = false;

/** Runs the reconcile unless one ran recently or is already running; resolves to an error
 * message (or null). */
function runReconcile(
  exceptions: ScmException[],
  replenishment: ReplenishmentRecommendation[],
  actor: string,
): Promise<string | null> | null {
  if (reconcileInFlight) return reconcileInFlight;
  if (
    !forceNextReconcile &&
    Date.now() - lastReconcileAt < RECONCILE_INTERVAL_MS
  )
    return null;
  forceNextReconcile = false;
  lastReconcileAt = Date.now();
  reconcileInFlight = Promise.all([
    reconcileExceptions(exceptions, actor),
    reconcileReplenishment(replenishment, actor),
  ])
    .then(([exc, rep]) => {
      const errors = [...exc.errors, ...rep.errors];
      return errors.length > 0
        ? `${errors.length} alert record(s) could not be saved: ${errors[0]}`
        : null;
    })
    .catch((err: unknown) => errorMessage(err, "Automation sync failed."))
    .finally(() => {
      reconcileInFlight = null;
    });
  return reconcileInFlight;
}

export interface UseControlTowerDataResult {
  loading: boolean;
  error: string | null;
  /** Set when persisting alerts/recommendations failed; the lists below are still valid. */
  automationError: string | null;
  exceptions: ScmException[];
  replenishment: ReplenishmentRecommendation[];
  /** True while the automation reconcile (persist + notify + audit) is running. */
  reconciling: boolean;
  /** Increments after each reconcile this hook observed finishing. */
  reconcileCount: number;
  reload: () => void;
}

export function useControlTowerData(): UseControlTowerDataResult {
  const {
    data,
    loading,
    error,
    loadedAt,
    reload: reloadReports,
  } = useScmReportsData();
  const { user } = useAuth();
  const [reconciling, setReconciling] = useState(false);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [reconcileCount, setReconcileCount] = useState(0);

  const ready = !loading && !error && loadedAt > 0;
  const exceptions = useMemo(
    () => (ready ? evaluateExceptions(data) : []),
    [data, ready],
  );
  const replenishment = useMemo(
    () => (ready ? computeReplenishmentRecommendations(data) : []),
    [data, ready],
  );
  const actor = actorName(user, "System");

  useEffect(() => {
    // Never reconcile (and so never auto-resolve) from a failed or partial load.
    if (!ready) return;
    const pending = runReconcile(exceptions, replenishment, actor);
    if (!pending) return;
    let active = true;
    setReconciling(true);
    void pending.then((message) => {
      if (!active) return;
      setAutomationError(message);
      setReconciling(false);
      setReconcileCount((n) => n + 1);
    });
    return () => {
      active = false;
    };
  }, [ready, exceptions, replenishment, actor]);

  const reload = useCallback(() => {
    forceNextReconcile = true;
    reloadReports();
  }, [reloadReports]);

  return {
    loading,
    error,
    automationError,
    exceptions,
    replenishment,
    reconciling,
    reconcileCount,
    reload,
  };
}
