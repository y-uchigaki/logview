import type { Stats } from "@/lib/openapi-client";

import { StatCard } from "@/components/ui/StatCard";

export function StatsSummaryGrid({ stats }: { stats: Stats | null }) {
  return (
    <div className="grid">
      <StatCard title="総件数" value={stats?.total ?? "—"} />
      <StatCard title="直近24時間" value={stats?.last24h ?? "—"} />
    </div>
  );
}
