export function StatsOpenAPIIntro({ specUrl }: { specUrl: string }) {
  return (
    <p className="sub">
      OpenAPI（<a href={specUrl}>{specUrl}</a>
      ）に定義された <code>GET /api/stats</code> から取得しています。
    </p>
  );
}
