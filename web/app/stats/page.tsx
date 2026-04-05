"use client";

import { useCallback, useEffect, useState } from "react";

import { AppNav } from "@/components/layout/AppNav";
import { StatsByLevel } from "@/components/stats/StatsByLevel";
import { StatsFetchError } from "@/components/stats/StatsFetchError";
import { StatsOpenAPIIntro } from "@/components/stats/StatsOpenAPIIntro";
import { StatsRecentMinutes } from "@/components/stats/StatsRecentMinutes";
import { StatsReloadBar } from "@/components/stats/StatsReloadBar";
import { StatsSeverityDayChart } from "@/components/stats/StatsSeverityDayChart";
import { StatsSummaryGrid } from "@/components/stats/StatsSummaryGrid";
import { getOpenAPISpecUrl, getStats, type Stats } from "@/lib/openapi-client";

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      setStats(await getStats());
    } catch (e) {
      setStats(null);
      setErr(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const specUrl = getOpenAPISpecUrl();

  return (
    <main>
      <AppNav active="stats" />
      <h1>集計</h1>
      <StatsOpenAPIIntro specUrl={specUrl} />
      <StatsReloadBar loading={loading} onReload={() => void load()} />
      <StatsFetchError message={err} />
      <StatsSummaryGrid stats={stats} />
      <StatsByLevel stats={stats} />
      <StatsSeverityDayChart />
      <StatsRecentMinutes stats={stats} />
    </main>
  );
}
