// components/Navbar.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react"; // 追記
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session } = useSession(); // 追記
  const pathname = usePathname();

  const navItems = [
    { name: "配信状況", path: "/feed" },
    { name: "チャンネル登録", path: "/channels" },
  ];

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-zinc-900 text-white shadow-md">
      <div className="text-xl font-bold tracking-tighter text-blue-400">
        にじウォッチ
      </div>
      
      <div className="flex gap-6">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`text-sm font-medium transition-colors hover:text-blue-400 ${
              pathname === item.path ? "text-blue-400 border-b-2 border-blue-400" : "text-zinc-400"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      {/* --- ここを書き換え --- */}
      <div className="flex items-center gap-4">
        {session ? (
          <div className="flex items-center gap-3">
            {session.user?.image && (
              <img src={session.user.image} alt="" className="w-8 h-8 rounded-full border border-zinc-700" />
            )}
            <span className="text-sm hidden md:block">{session.user?.name}さん</span>
            <button 
              onClick={() => signOut()} 
              className="text-xs text-zinc-500 hover:text-white underline"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <button 
            onClick={() => signIn("google")}
            className="px-4 py-2 text-sm font-medium bg-white text-black rounded-full hover:bg-zinc-200"
          >
            ログイン
          </button>
        )}
      </div>
    </nav>
  );
}