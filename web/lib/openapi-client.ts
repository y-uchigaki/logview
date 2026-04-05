/**
 * Logview HTTP API クライアント（`GET /openapi.yaml` の paths / components と対応）
 */
import { getApiBase } from "@/lib/api";

const JSON_HEADERS = { Accept: "application/json" } as const;

export type LogEntry = {
  id: number;
  createdAt: string;
  host: string;
  level: string;
  message: string;
  meta?: unknown;
};

export type Stats = {
  total: number;
  byLevel: Record<string, number>;
  last24h: number;
  recentPerMin: { minute: string; count: number }[];
};

export type SeverityDayBucket = {
  hour: number;
  label: string;
  error: number;
  critical: number;
  fatal: number;
};

export type SeverityDayResult = {
  date: string;
  timezone: string;
  buckets: SeverityDayBucket[];
};

export type LogIngest = {
  host?: string;
  level?: string;
  message: string;
  meta?: unknown;
};

function base(): string {
  return getApiBase();
}

function coerceNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** API の欠損・null に耐える（空 DB や古いクライアント向け） */
export function parseStats(raw: unknown): Stats {
  if (!raw || typeof raw !== "object") {
    return { total: 0, last24h: 0, byLevel: {}, recentPerMin: [] };
  }
  const o = raw as Record<string, unknown>;
  const byLevel: Record<string, number> = {};
  const bl = o.byLevel;
  if (bl && typeof bl === "object" && !Array.isArray(bl)) {
    for (const [k, v] of Object.entries(bl)) {
      byLevel[k] = coerceNumber(v);
    }
  }
  const recentPerMin: { minute: string; count: number }[] = [];
  if (Array.isArray(o.recentPerMin)) {
    for (const item of o.recentPerMin) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      recentPerMin.push({
        minute:
          typeof it.minute === "string"
            ? it.minute
            : String(it.minute ?? ""),
        count: coerceNumber(it.count),
      });
    }
  }
  return {
    total: coerceNumber(o.total),
    last24h: coerceNumber(o.last24h),
    byLevel,
    recentPerMin,
  };
}

export function parseSeverityDayResult(raw: unknown): SeverityDayResult {
  if (!raw || typeof raw !== "object") {
    return { date: "", timezone: "", buckets: [] };
  }
  const o = raw as Record<string, unknown>;
  const rawBuckets = Array.isArray(o.buckets) ? o.buckets : [];
  const buckets: SeverityDayBucket[] = [];
  for (const b of rawBuckets) {
    if (!b || typeof b !== "object") continue;
    const x = b as Record<string, unknown>;
    buckets.push({
      hour: coerceNumber(x.hour),
      label:
        typeof x.label === "string" ? x.label : String(x.label ?? ""),
      error: coerceNumber(x.error),
      critical: coerceNumber(x.critical),
      fatal: coerceNumber(x.fatal),
    });
  }
  return {
    date: typeof o.date === "string" ? o.date : "",
    timezone: typeof o.timezone === "string" ? o.timezone : "",
    buckets,
  };
}

/** operationId: getStats */
export async function getStats(init?: RequestInit): Promise<Stats> {
  const r = await fetch(`${base()}/api/stats`, {
    ...init,
    headers: { ...JSON_HEADERS, ...init?.headers },
  });
  if (!r.ok) {
    throw new Error(`getStats: ${r.status}`);
  }
  const data: unknown = await r.json();
  return parseStats(data);
}

/** operationId: getSeverityDayByHour */
export async function getSeverityDayByHour(
  params: { date: string; timezone?: string },
  init?: RequestInit,
): Promise<SeverityDayResult> {
  const q = new URLSearchParams({ date: params.date });
  if (params.timezone) {
    q.set("timezone", params.timezone);
  }
  if (!params.date?.trim()) {
    throw new Error("getSeverityDayByHour: date is required");
  }
  const r = await fetch(`${base()}/api/stats/severity-day?${q}`, {
    ...init,
    headers: { ...JSON_HEADERS, ...init?.headers },
  });
  if (!r.ok) {
    const hint = (await r.text()).trim().slice(0, 200);
    throw new Error(
      hint
        ? `getSeverityDayByHour: ${r.status} — ${hint}`
        : `getSeverityDayByHour: ${r.status}`,
    );
  }
  const data: unknown = await r.json();
  return parseSeverityDayResult(data);
}

export function parseLogEntry(raw: unknown): LogEntry {
  if (!raw || typeof raw !== "object") {
    return {
      id: 0,
      createdAt: "",
      host: "",
      level: "",
      message: "",
    };
  }
  const x = raw as Record<string, unknown>;
  return {
    id: coerceNumber(x.id),
    createdAt:
      typeof x.createdAt === "string"
        ? x.createdAt
        : String(x.createdAt ?? ""),
    host: typeof x.host === "string" ? x.host : String(x.host ?? ""),
    level: typeof x.level === "string" ? x.level : String(x.level ?? ""),
    message:
      typeof x.message === "string"
        ? x.message
        : String(x.message ?? ""),
    meta: x.meta,
  };
}

/** operationId: listLogs */
export async function listLogs(init?: RequestInit): Promise<LogEntry[]> {
  const r = await fetch(`${base()}/api/logs`, {
    ...init,
    headers: { ...JSON_HEADERS, ...init?.headers },
  });
  if (!r.ok) {
    throw new Error(`listLogs: ${r.status}`);
  }
  const data: unknown = await r.json();
  if (!Array.isArray(data)) return [];
  return data.map(parseLogEntry);
}

/** operationId: createLog */
export async function createLog(
  body: LogIngest,
  init?: RequestInit,
): Promise<LogEntry> {
  const r = await fetch(`${base()}/api/logs`, {
    method: "POST",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...JSON_HEADERS,
      ...init?.headers,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`createLog: ${r.status}`);
  }
  return r.json() as Promise<LogEntry>;
}

/** OpenAPI 定義の URL（バックエンドが配信） */
export function getOpenAPISpecUrl(): string {
  return `${base()}/openapi.yaml`;
}
