"use client";

import { useCallback, useEffect, useState } from "react";

import { AppNav } from "@/components/layout/AppNav";
import { LiveSeedError } from "@/components/live/LiveSeedError";
import { LiveStreamPanel } from "@/components/live/LiveStreamPanel";
import { useLogWebSocket, type LogEntry } from "@/hooks/useLogWebSocket";
import { getApiBase } from "@/lib/api";
import { listLogs } from "@/lib/openapi-client";

const apiBase = getApiBase();

export default function Page() {
  const [live, setLive] = useState<LogEntry[]>([]);
  const [seedErr, setSeedErr] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    setSeedErr(null);
    try {
      const list = await listLogs();
      setLive(list);
    } catch (e) {
      setSeedErr(e instanceof Error ? e.message : "fetch failed");
    }
  }, []);

  const { status: wsState } = useLogWebSocket({
    apiBase,
    onLog: (entry) => {
      setLive((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        return [entry, ...base].slice(0, 200);
      });
    },
  });

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  return (
    <main>
      <AppNav active="live" />
      <h1>ライブログ</h1>
      <LiveSeedError message={seedErr} />
      <LiveStreamPanel wsState={wsState} entries={live ?? []} />
    </main>
  );
}
