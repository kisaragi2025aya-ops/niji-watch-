// app/feed/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function FeedPage() {
  // 1. status を追加して定義
  const { data: session, status } = useSession();
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [oshiList, setOshiList] = useState<{ id: string, name: string }[]>([]);

  // 2. DBからリストを読み込む
  useEffect(() => {
    const fetchOshiFromDB = async () => {
      try {
        const res = await fetch('/api/oshi');
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setOshiList(data);
      } catch (error) {
        console.error("推しリストの取得に失敗:", error);
      }
    };

    // ログイン済みなら取得開始
    if (status === "authenticated") {
      fetchOshiFromDB();
    }
  }, [status]); // statusを監視

  const checkAll = async () => {
    // oshiListが空なら何もしない
    if (!oshiList || oshiList.length === 0) return;
    
    const newResults: { [key: string]: string } = {};
    await Promise.all(oshiList.map(async (oshi) => {
      try {
        const res = await fetch(`/api/check?channelId=${oshi.id}`);
        const data = await res.json();
        newResults[oshi.id] = data.isLive ? "🔴 ライブ配信中！" : "⚪ オフライン";
      } catch (e) {
        newResults[oshi.id] = "⚪ オフライン";
      }
    }));
    setResults(newResults);
  };

  // 自動チェック
  useEffect(() => {
    if (oshiList.length > 0) {
      checkAll();
      const timer = setInterval(checkAll, 60000);
      return () => clearInterval(timer);
    }
  }, [oshiList]); // oshiList全体を監視

  // ソート処理
  const sortedOshiList = [...oshiList].sort((a, b) => {
    const aResult = results[a.id] || "";
    const bResult = results[b.id] || "";
    if (aResult.includes("🔴") && !bResult.includes("🔴")) return -1;
    if (!aResult.includes("🔴") && bResult.includes("🔴")) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* 配信一覧 */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">配信状況</h2>
          <button onClick={checkAll} className="text-sm bg-zinc-800 px-3 py-1 rounded hover:bg-zinc-700">更新</button>
        </div>

        {oshiList.length === 0 ? (
          <div className="text-center p-10 bg-zinc-900 rounded-lg border border-dashed border-zinc-700">
            <p className="text-zinc-500 mb-4">推しがまだ登録されていません</p>
            <p className="text-sm text-zinc-600">設定ページからYouTube同期を行ってください</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sortedOshiList.map((oshi) => {
              const isLive = (results[oshi.id] || "").includes("🔴");
              return (
                <div
                  key={oshi.id}
                  onClick={() => window.open(`https://www.youtube.com/channel/${oshi.id}/live`, '_blank')}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    isLive ? "bg-blue-900/20 border-blue-500" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">{oshi.name}</h3>
                      <p className={`text-sm ${isLive ? "text-blue-400 animate-pulse" : "text-zinc-500"}`}>
                        {results[oshi.id] || "確認中..."}
                      </p>
                    </div>
                    {isLive && <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold">LIVE</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}