import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface DashboardKpi {
  id: string;
  label: string;
  value: number | string;
  icon: LucideIcon;
  onClick?: () => void;
}

/** Clickable icon KPI tiles used at the top of every SCM domain dashboard. */
export function DashboardKpiGrid({
  kpis,
  loading,
}: {
  kpis: DashboardKpi[];
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <Card
          key={k.id}
          className={
            k.onClick
              ? "cursor-pointer hover:shadow-md transition-shadow"
              : undefined
          }
          onClick={k.onClick}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shrink-0">
              <k.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {loading ? "—" : k.value}
              </div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
