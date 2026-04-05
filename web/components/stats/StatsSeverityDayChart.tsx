"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getSeverityDayByHour,
  type SeverityDayResult,
} from "@/lib/openapi-client";

const DEFAULT_TZ = "Asia/Tokyo";

/** 常に YYYY-MM-DD（toLocaleDateString 直だと OS により 2026/04/04 等で API が 400 になる） */
function tokyoTodayISO(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = (parts.find((p) => p.type === "month")?.value ?? "").padStart(2, "0");
  const d = (parts.find((p) => p.type === "day")?.value ?? "").padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function StatsSeverityDayChart() {
  const [date, setDate] = useState(() => tokyoTodayISO());
  const [data, setData] = useState<SeverityDayResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      setData(await getSeverityDayByHour({ date, timezone: DEFAULT_TZ }));
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartRows = useMemo(() => {
    const b = data?.buckets;
    return Array.isArray(b) ? b : [];
  }, [data]);

  const yDomainMax = useMemo(() => {
    let m = 0;
    for (const row of chartRows) {
      m = Math.max(
        m,
        row.error ?? 0,
        row.critical ?? 0,
        row.fatal ?? 0,
      );
    }
    return Math.max(1, m);
  }, [chartRows]);

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <div className="row-head" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "0.9rem",
              color: "var(--text)",
            }}
          >
            重大度別（1 時間ごと）
          </h2>
          <p className="sub" style={{ margin: "0.25rem 0 0" }}>
            <code>error</code> / <code>critical</code> / <code>fatal</code> の件数。暦日・集計帯は{" "}
            <code>{DEFAULT_TZ}</code> 基準です。
          </p>
        </div>
        <label className="date-field">
          <span className="date-field-label">日付</span>
          <input
            type="date"
            value={date}
            max="2099-12-31"
            onChange={(e) => setDate(e.target.value)}
            disabled={loading}
          />
        </label>
      </div>

      {err && (
        <p className="sub" style={{ color: "var(--err)", marginBottom: "0.75rem" }}>
          {err}
        </p>
      )}

      <div className="chart-wrap">
        {loading && (
          <p className="sub" style={{ margin: 0, padding: "1rem 0" }}>
            読み込み中…
          </p>
        )}
        {!loading && !err && chartRows.length === 0 && (
          <p className="sub" style={{ margin: 0, padding: "1rem 0" }}>
            表示できるバケットがありません。
          </p>
        )}
        {!loading && chartRows.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minHeight={280}>
            <LineChart
              data={chartRows}
              margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                interval={3}
              />
              <YAxis
                allowDecimals={false}
                width={36}
                domain={[0, yDomainMax]}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "var(--text)" }}
              />
              <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
              <Line
                type="monotone"
                dataKey="error"
                name="error"
                stroke="var(--err)"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="critical"
                name="critical"
                stroke="var(--warn)"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="fatal"
                name="fatal"
                stroke="#c45cff"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
