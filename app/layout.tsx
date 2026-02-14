// app/layout.tsx
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers"; // 追加
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-black text-white min-h-screen">
        <Providers> {/* これで包む */}
          <Navbar />
          <main className="max-w-4xl mx-auto p-4">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}