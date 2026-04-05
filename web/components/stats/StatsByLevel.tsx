import { useMemo } from "react";

import type { Stats } from "@/lib/openapi-client";

export function StatsByLevel({ stats }: { stats: Stats | null }) {
  const maxLevel = useMemo(() => {
    const bl = stats?.byLevel;
    if (!bl || typeof bl !== "object") return 1;
    let m = 1;
    for (const v of Object.values(bl)) {
      const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
      if (n > m) m = n;
    }
    return m;
  }, [stats]);

  if (!stats) return null;

  const levels = Object.entries(stats.byLevel ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h2 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text)" }}>
        レベル別件数
      </h2>
      {levels.length === 0 && (
        <p className="sub" style={{ marginTop: "0.5rem" }}>
          データなし
        </p>
      )}
      {levels.map(([lvl, n]) => (
        <div key={lvl} className="level-row">
          <span>{lvl}</span>
          <div className="bar-wrap">
            <div
              className="bar"
              style={{
                width: `${Math.max(8, (n / maxLevel) * 100)}%`,
                opacity: 0.75,
              }}
            />
          </div>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{n}</span>
        </div>
      ))}
    </div>
  );
}
