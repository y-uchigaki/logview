import Link from "next/link";

type NavActive = "live" | "stats";

export function AppNav({ active }: { active: NavActive }) {
  return (
    <nav className="nav">
      {active === "live" ? (
        <span className="nav-active">ライブ</span>
      ) : (
        <Link href="/">ライブ</Link>
      )}
      <span className="nav-sep">|</span>
      {active === "stats" ? (
        <span className="nav-active">集計</span>
      ) : (
        <Link href="/stats">集計</Link>
      )}
    </nav>
  );
}
