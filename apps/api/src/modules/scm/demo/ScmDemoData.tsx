// Admin-only utility page (not linked from the SCM sidebar): seeds or removes the SCM demo dataset.
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Database, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage } from "@/modules/scm/shared/format";
import {
  getDemoSeedStatus,
  removeDemoSeed,
  runDemoSeed,
  type DemoSeedMeta,
} from "./demoSeedService";

const CONFIRM_WORD = "SEED";

export default function ScmDemoData() {
  const { user } = useAuth();
  const [status, setStatus] = useState<DemoSeedMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const logEnd = useRef<HTMLDivElement>(null);
  const databaseUrl =
    import.meta.env.VITE_FIREBASE_DATABASE_URL || "(default Firebase project)";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getDemoSeedStatus());
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to read demo data status"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);

  const log = (message: string) =>
    setLines((l) => [...l, `${new Date().toLocaleTimeString()}  ${message}`]);

  const run = async (action: "seed" | "remove") => {
    setRunning(true);
    setLines([]);
    try {
      if (action === "seed") await runDemoSeed(actorName(user), log);
      else await removeDemoSeed(log);
      toast.success(
        action === "seed" ? "Demo data seeded" : "Demo data removed",
      );
    } catch (err: unknown) {
      const msg = errorMessage(err, "Failed");
      log(`ERROR: ${msg}`);
      toast.error(msg);
    } finally {
      setRunning(false);
      setConfirm("");
      load();
    }
  };

  if (user?.role !== "admin") {
    return (
      <p className="text-muted-foreground py-10 text-center">
        Only administrators can manage SCM demo data.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">SCM Demo Data</h2>
        <p className="text-muted-foreground mt-1">
          Seeds a four-month supply-chain story through the real SCM workflows:
          8 products, 2 warehouses, 5 suppliers, 4 customers, 14 sales orders, 6
          purchase orders, returns, QC and in-flight work for a live
          walkthrough.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 flex gap-3 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            Writes to <span className="font-mono break-all">{databaseUrl}</span>
            . It adds customers, products and sales orders to the Sales module
            and suppliers to Contacts. Run it against a demo or staging
            database. Everything it creates can be removed with{" "}
            <em>Remove demo data</em>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-brand-600" />
            <span className="font-medium">Status</span>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status ? (
              <Badge
                className="bg-emerald-50 text-emerald-700 border-emerald-200"
                variant="outline"
              >
                Seeded — {status.recordCount} records by {status.seededBy}
              </Badge>
            ) : (
              <Badge variant="outline">Not seeded</Badge>
            )}
          </div>

          {!status && (
            <div className="flex flex-wrap items-center gap-3">
              <Input
                className="w-48"
                placeholder={`Type ${CONFIRM_WORD} to confirm`}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={running}
              />
              <Button
                onClick={() => run("seed")}
                disabled={running || confirm !== CONFIRM_WORD}
              >
                {running ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Seed demo data
              </Button>
            </div>
          )}
          {status && (
            <Button
              variant="destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete all ${status.recordCount} demo records?`,
                  )
                )
                  run("remove");
              }}
              disabled={running}
            >
              {running ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove demo data
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Seeding takes roughly 2–5 minutes. Keep this tab open until it
            finishes.
          </p>
        </CardContent>
      </Card>

      {lines.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="font-mono text-xs max-h-96 overflow-y-auto space-y-0.5">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.includes("ERROR") ? "text-red-600" : "text-slate-700"
                  }
                >
                  {l}
                </div>
              ))}
              <div ref={logEnd} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
