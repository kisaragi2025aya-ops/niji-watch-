// app/feed/_components/LiveStatus.tsx
"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    const fetchOshiFromDB = async () => {
      try {
        const res = await fetch('/api/oshi');
        const data = await res.json();
        setOshiList(data);
      } catch (error) {
        console.error("推しリストの取得に失敗:", error);
      }
    };
    if (status === "authenticated") fetchOshiFromDB();
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
          thumbnail: data.thumbnail,
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

  const sortedOshiList = [...oshiList].sort((a, b) => 
    (results[b.id]?.isLive ? 1 : 0) - (results[a.id]?.isLive ? 1 : 0)
  );

  return (
    <div className="grid gap-4">
      {sortedOshiList.map((oshi) => {
        const liveData = results[oshi.id];
        const isLive = liveData?.isLive;
        const displayImage = (isLive && liveData?.thumbnail) ? liveData.thumbnail : oshi.image;

        return (
          <div
            key={oshi.id}
            onClick={() => window.open(`https://www.youtube.com/channel/${oshi.id}/live`, '_blank')}
            className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
              isLive ? "bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="relative flex-shrink-0">
              <img src={displayImage || "/api/placeholder/64/64"} alt="" className={`object-cover rounded-lg ${isLive ? "w-24 h-14" : "w-14 h-14 rounded-full"}`} />
              {isLive && <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">LIVE</span>}
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="font-bold text-base text-white truncate">{oshi.name}</h3>
              <p className={`text-xs mt-1 truncate ${isLive ? "text-blue-400 font-medium" : "text-zinc-500"}`}>{liveData?.statusText || "確認中..."}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}