import type { LogEntry } from "@/lib/openapi-client";

import { LogListItem } from "@/components/live/LogListItem";

export function LogList({ entries }: { entries: LogEntry[] }) {
  return (
    <ul className="log-list">
      {entries.map((e, i) => (
        <LogListItem key={e.id ? `id-${e.id}` : `i-${i}`} entry={e} />
      ))}
    </ul>
  );
}
