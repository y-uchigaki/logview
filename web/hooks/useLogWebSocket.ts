"use client";

import { useEffect, useRef, useState } from "react";

import { getApiBase, getWebSocketUrl } from "@/lib/api";
import { parseLogEntry, type LogEntry } from "@/lib/openapi-client";

export type { LogEntry };

export type UseLogWebSocketStatus = "connecting" | "open" | "closed";

export type UseLogWebSocketOptions = {
  apiBase?: string;
  onLog?: (entry: LogEntry) => void;
  reconnectIntervalMs?: number;
  enabled?: boolean;
};

/**
 * Logview バックエンドの `/ws` に接続し、新着ログをコールバックで渡す。
 * アンマウント時は接続を閉じ、再接続タイマーを解除する。
 */
export function useLogWebSocket(
  options: UseLogWebSocketOptions = {},
): { status: UseLogWebSocketStatus; lastWsError: string | null } {
  const {
    apiBase = getApiBase(),
    onLog,
    reconnectIntervalMs = 2000,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<UseLogWebSocketStatus>("closed");
  const [lastWsError, setLastWsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const stoppedRef = useRef(false);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const url = getWebSocketUrl(apiBase);

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }

    stoppedRef.current = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current !== undefined) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = undefined;
      }
    };

    const connect = () => {
      if (stoppedRef.current) return;
      clearReconnect();
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (stoppedRef.current || wsRef.current !== ws) return;
        setLastWsError(null);
        setStatus("open");
      };

      ws.onerror = () => {
        if (stoppedRef.current || wsRef.current !== ws) return;
        setLastWsError(`接続失敗: ${url}`);
      };

      ws.onclose = (ev) => {
        // React Strict Mode 等で古い接続の onclose が新しい ws を壊さないようにする
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (stoppedRef.current) return;
        if (wsRef.current !== null) {
          return;
        }
        setStatus("closed");
        if (ev.code !== 1000) {
          setLastWsError(
            `切断 (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`,
          );
        }
        reconnectTimerRef.current = setTimeout(connect, reconnectIntervalMs);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type?: string;
            log?: LogEntry;
          };
          if (msg.type === "log" && msg.log) {
            onLogRef.current?.(parseLogEntry(msg.log));
          }
        } catch {
          /* 不正 JSON は無視 */
        }
      };
    };

    connect();

    return () => {
      stoppedRef.current = true;
      clearReconnect();
      wsRef.current?.close();
      wsRef.current = null;
      setStatus("closed");
    };
  }, [enabled, url, reconnectIntervalMs]);

  return { status, lastWsError };
}
