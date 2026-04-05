/** Docker Compose 既定の API 公開ポート（18080）に合わせる。ローカルで go run だけなら .env.local で 8080 等を指定 */
const DEFAULT_API_BASE = "http://127.0.0.1:18080";

export function getApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || DEFAULT_API_BASE
  );
}

/** HTTP(S) のオリジンから Logview の WebSocket URL を組み立てる */
export function getWebSocketUrl(httpBase: string = getApiBase()): string {
  const u = new URL(httpBase);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  u.search = "";
  return u.toString();
}
