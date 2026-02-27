"use client";

import { useState } from "react";
import LiveStatus from "./_components/LiveStatus";
import Recommendation from "./_components/Recommendation";

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<"live" | "recommend">("live");

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 py-6">
      {/* ヘッダーセクション: ロゴとテキストを削除し、タブ切り替えのみを配置 */}
      <header className="flex justify-center md:justify-end">
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab("live")}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === "live" 
                ? "bg-zinc-800 text-white shadow-lg" 
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            配信状況
          </button>
          <button
            onClick={() => setActiveTab("recommend")}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === "recommend" 
                ? "bg-zinc-800 text-white shadow-lg" 
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            おすすめ
          </button>
        </div>
      </header>

      {/* コンテンツエリア */}
      <main className="min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-500">
        {activeTab === "live" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Live Monitoring</h2>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-zinc-500 text-[10px] font-bold">AUTO UPDATE ON</span>
              </div>
            </div>
            <LiveStatus />
          </div>
        ) : (
          <Recommendation />
        )}
      </main>

      <footer className="pt-20 pb-10 text-center">
        <p className="text-zinc-700 text-[10px] font-medium tracking-widest uppercase">
          &copy; 2026 NIJI WATCH PROJECT
        </p>
      </footer>
    </div>
  );
}