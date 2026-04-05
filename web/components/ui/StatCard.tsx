import type { ReactNode } from "react";

export function StatCard({
  title,
  value,
}: {
  title: string;
  value: ReactNode;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="val">{value}</div>
    </div>
  );
}
