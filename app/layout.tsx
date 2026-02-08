"use client";

import { SessionProvider } from "next-auth/react";
import "./globals.css";
// もし Inter などのフォント設定があれば残しておいてOK

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {/* SessionProviderで包むことで、アプリ中でログイン情報が使えるようになります */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}