"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

// 型定義を追加
interface LiveResult {
  isLive: boolean;
  thumbnail?: string;
  statusText: string;
}

export default function FeedPage() {
  const { data: session, status } = useSession();
  // results の型を文字列からオブジェクトに変更
  const [results, setResults] = useState<{ [key: string]: LiveResult }>({});
  const [oshiList, setOshiList] = useState<{ id: string, name: string, image?: string }[]>([]);

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

    if (status === "authenticated") {
      fetchOshiFromDB();
    }
  }, [status]);

  const checkAll = async () => {
    if (!oshiList || oshiList.length === 0) return;
    
    const newResults: { [key: string]: LiveResult } = {};
    await Promise.all(oshiList.map(async (oshi) => {
      try {
        const res = await fetch(`/api/check?channelId=${oshi.id}`);
        const data = await res.json();
        
        newResults[oshi.id] = {
          isLive: data.isLive,
          thumbnail: data.thumbnail, // API側でライブサムネを返す想定
          statusText: data.isLive ? (data.title || "ライブ配信中！") : "⚪ オフライン"
        };
      } catch (e) {
        newResults[oshi.id] = { isLive: false, statusText: "⚪ オフライン" };
      }
    }));
    setResults(newResults);
  };

  useEffect(() => {
    if (oshiList.length > 0) {
      checkAll();
      const timer = setInterval(checkAll, 60000);
      return () => clearInterval(timer);
    }
  }, [oshiList]);

  const sortedOshiList = [...oshiList].sort((a, b) => {
    const aLive = results[a.id]?.isLive ? 1 : 0;
    const bLive = results[b.id]?.isLive ? 1 : 0;
    return bLive - aLive; // 配信中を上に
  });

  return (
    <div className="space-y-6">
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">配信状況</h2>
          <button onClick={checkAll} className="text-sm bg-zinc-800 px-3 py-1 rounded hover:bg-zinc-700 text-zinc-300">更新</button>
        </div>

        {oshiList.length === 0 ? (
          <div className="text-center p-10 bg-zinc-900 rounded-lg border border-dashed border-zinc-700">
            <p className="text-zinc-500 mb-4">推しがまだ登録されていません</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedOshiList.map((oshi) => {
              const liveData = results[oshi.id];
              const isLive = liveData?.isLive;
              // 表示する画像：配信中ならライブサムネ、そうでなければDBのアイコン
              const displayImage = (isLive && liveData?.thumbnail) ? liveData.thumbnail : oshi.image;

              return (
                <div
                  key={oshi.id}
                  onClick={() => window.open(`https://www.youtube.com/channel/${oshi.id}/live`, '_blank')}
                  className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
                    isLive ? "bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* 画像エリア */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={displayImage || "/api/placeholder/64/64"} 
                      alt={oshi.name}
                      className={`object-cover rounded-lg ${
                        isLive ? "w-24 h-14" : "w-14 h-14 rounded-full"
                      }`}
                    />
                    {isLive && (
                      <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">
                        LIVE
                      </span>
                    )}
                  </div>

                  {/* 📝 テキストエリア：タイトルが長いので truncate をしっかり効かせます */}
                  <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-base text-white truncate">{oshi.name}</h3>
                    <p className={`text-xs mt-1 truncate ${isLive ? "text-blue-400 font-medium" : "text-zinc-500"}`}>
                      {liveData?.statusText || "確認中..."}
                    </p>
                  </div>

                  {/* 右側の矢印（装飾） */}
                  <div className="text-zinc-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                    </svg>
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