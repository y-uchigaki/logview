import type { Stats } from "@/lib/openapi-client";

export function StatsRecentMinutes({ stats }: { stats: Stats | null }) {
  if (!stats) return null;

  const rows = Array.isArray(stats.recentPerMin) ? stats.recentPerMin : [];

  return (
    <div className="card">
      <h2 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text)" }}>
        直近60分（分単位）
      </h2>
      {rows.length === 0 && (
        <p className="sub" style={{ marginTop: "0.5rem" }}>
          データなし
        </p>
      )}
      <ul className="bucket-list">
        {rows.map((b, i) => (
          <li key={b.minute || `m-${i}`}>
            <time dateTime={b.minute}>{b.minute || "—"}</time>
            <span>{b.count ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
