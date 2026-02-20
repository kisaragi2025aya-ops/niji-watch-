// app/feed/page.tsx
"use client";

import { useState } from "react";
import LiveStatus from "./_components/LiveStatus";
import Recommendation from "./_components/Recommendation";

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<"live" | "recommend">("live");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* タブ切り替えUI */}
      <div className="flex gap-8 border-b border-zinc-800 px-2">
        <button
          onClick={() => setActiveTab("live")}
          className={`pb-4 text-sm font-bold transition-all ${
            activeTab === "live" ? "border-b-2 border-blue-500 text-white" : "text-zinc-500"
          }`}
        >
          配信状況
        </button>
        <button
          onClick={() => setActiveTab("recommend")}
          className={`pb-4 text-sm font-bold transition-all ${
            activeTab === "recommend" ? "border-b-2 border-blue-500 text-white" : "text-zinc-500"
          }`}
        >
          おすすめ
        </button>
      </div>

      {/* コンテンツの表示 */}
      <div className="mt-4 px-2">
        {activeTab === "live" ? <LiveStatus /> : <Recommendation />}
      </div>
    </div>
  );
}