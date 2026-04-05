import type { UseLogWebSocketStatus } from "@/hooks/useLogWebSocket";
import type { LogEntry } from "@/lib/openapi-client";

import { LogList } from "@/components/live/LogList";

export function LiveStreamPanel({
  wsState,
  entries,
}: {
  wsState: UseLogWebSocketStatus;
  entries: LogEntry[];
}) {
  return (
    <div className="card">
      <div className="row-head">
        <h2 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text)" }}>
          ストリーム
        </h2>
        <span className={`badge ${wsState === "open" ? "live" : "off"}`}>
          {wsState === "open" ? "WS 購読中" : "WS 未接続"}
        </span>
      </div>
      <LogList entries={entries} />
    </div>
  );
}
