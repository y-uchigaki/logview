import type { LogEntry } from "@/lib/openapi-client";

export function LogListItem({ entry: e }: { entry: LogEntry }) {
  const ts = e.createdAt ? new Date(e.createdAt) : null;
  const timeOk = Boolean(ts && !Number.isNaN(ts.getTime()));
  const timeLabel = timeOk && ts ? ts.toLocaleString("ja-JP") : "—";
  const level = e.level ?? "";
  const msg = e.message ?? "";
  const host = e.host ?? "";

  return (
    <li>
      <time dateTime={e.createdAt ?? undefined}>{timeLabel}</time>
      <span className={`log-level ${level}`}>{level || "—"}</span>
      {host ? (
        <span className="log-msg" style={{ color: "var(--muted)" }}>
          [{host}] {msg}
        </span>
      ) : (
        <span className="log-msg">{msg || "—"}</span>
      )}
    </li>
  );
}
