"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface LiveResult {
  isLive: boolean;
  thumbnail?: string;
  statusText: string;
}

export default function LiveStatus() {
  const { data: session, status } = useSession();
  const [results, setResults] = useState<{ [key: string]: LiveResult }>({});
  const [oshiList, setOshiList] = useState<{ id: string, name: string, image?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. ページ読み込み時にDBから「推しリスト」を取得
  const fetchOshiFromDB = async () => {
    try {
      // Vercelのキャッシュを回避するために { cache: 'no-store' } を追加
      const res = await fetch('/api/oshi', { cache: 'no-store' });
      const data = await res.json();
      setOshiList(data);
    } catch (error) {
      console.error("推しリストの取得に失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchOshiFromDB();
  }, [status]);

  // 2. ライブ状況を一括チェックする関数
  const checkAll = useCallback(async () => {
    if (!oshiList || oshiList.length === 0) return;

    try {
      const ids = oshiList.map(o => o.id).join(",");
      // APIリクエスト時もキャッシュを無視するように設定
      const res = await fetch(`/api/check?channelIds=${ids}`, { 
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();

      const newResults: { [key: string]: LiveResult } = {};
      oshiList.forEach(oshi => {
        const liveInfo = data[oshi.id];
        newResults[oshi.id] = {
          isLive: liveInfo?.isLive || false,
          thumbnail: liveInfo?.thumbnail,
          statusText: liveInfo?.isLive ? (liveInfo.title || "配信中") : "⚪ オフライン"
        };
      });

      setResults(newResults);
    } catch (e) {
      console.error("一括チェック失敗:", e);
    }
  }, [oshiList]);

  // 3. 定期実行タイマーの設定（1分ごと）
  useEffect(() => {
    if (oshiList.length > 0) {
      checkAll();
      const timer = setInterval(checkAll, 60000);
      return () => clearInterval(timer);
    }
  }, [oshiList, checkAll]);

  // 4. ライブ中の人を優先して並び替え
  const sortedOshiList = [...oshiList].sort((a, b) => {
    const aLive = results[a.id]?.isLive ? 1 : 0;
    const bLive = results[b.id]?.isLive ? 1 : 0;
    return bLive - aLive;
  });

  if (loading) return <div className="text-center py-10 text-zinc-500 text-sm">読み込み中...</div>;
  if (oshiList.length === 0) return <div className="text-center py-10 text-zinc-500 text-sm">推しが登録されていません</div>;

  return (
    <div className="grid gap-3">
      {sortedOshiList.map((oshi) => {
        const liveData = results[oshi.id];
        const isLive = liveData?.isLive;
        const displayImage = (isLive && liveData?.thumbnail) ? liveData.thumbnail : oshi.image;

        return (
          <div
            key={oshi.id}
            onClick={() => window.open(`https://www.youtube.com/channel/${oshi.id}/live`, '_blank')}
            className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 cursor-pointer ${
              isLive 
                ? "bg-blue-600/10 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.1)] hover:bg-blue-600/20" 
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="relative flex-shrink-0">
              <img 
                src={displayImage || "/api/placeholder/64/64"} 
                alt="" 
                className={`object-cover transition-all duration-500 ${
                  isLive ? "w-28 h-16 rounded-lg" : "w-14 h-14 rounded-full"
                }`} 
              />
              {isLive && (
                <div className="absolute -top-2 -left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg animate-pulse">
                  LIVE
                </div>
              )}
            </div>
            
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm md:text-base text-white truncate">
                  {oshi.name}
                </h3>
                {isLive && <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />}
              </div>
              <p className={`text-xs mt-1 truncate ${isLive ? "text-blue-400 font-medium" : "text-zinc-500"}`}>
                {liveData?.statusText || "確認中..."}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}