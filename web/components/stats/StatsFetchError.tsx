export function StatsFetchError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="sub" style={{ color: "var(--err)" }}>
      取得に失敗: {message}
    </p>
  );
}
