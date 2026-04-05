export function StatsReloadBar({
  loading,
  onReload,
}: {
  loading: boolean;
  onReload: () => void;
}) {
  return (
    <div className="row-head" style={{ marginBottom: "1rem" }}>
      <button type="button" onClick={onReload} disabled={loading}>
        {loading ? "取得中…" : "再取得"}
      </button>
    </div>
  );
}
