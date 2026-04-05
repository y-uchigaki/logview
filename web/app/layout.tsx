import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logview",
  description: "サーバー起動ログの集計とライブ表示",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
