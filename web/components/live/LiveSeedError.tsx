export function LiveSeedError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="sub" style={{ color: "var(--err)" }}>
      初回一覧の取得に失敗: {message}
    </p>
  );
}
