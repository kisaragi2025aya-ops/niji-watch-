"use client";
import { useState } from "react";
import axios from "axios";

// 1. チェックしたい推しのリスト（JavaでいうArrayListのようなもの）
const OSHI_LIST = [
  { id: 'UCZf_7m96pylvgOOIDaccEnA', name: 'にじさんじ公式' },
  { id: 'UC_82H3XUnitVGVzWSeL1A1g', name: '壱番魔露ノサロメ' },
  { id: 'UCD-miitqNY3nyukJ4Fnf4_A', name: '月ノ美兎' },
];

export default function Home() {
  // 2. 結果を保存する「Map」のような状態
  const [results, setResults] = useState<{[key: string]: string}>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const checkLive = async (channelId: string) => {
    setLoadingId(channelId);
    try {
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${API_KEY}`;
      
      const response = await axios.get(url);
      const isLive = response.data.items.length > 0;

      // 結果をセット（前の結果を保持しつつ、新しいIDの結果を上書き保存）
      setResults(prev => ({
        ...prev,
        [channelId]: isLive ? "🔴 ライブ配信中！" : "⚪ オフライン"
      }));
    } catch (e) {
      console.error("エラーです", e);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-center">推し生存確認リスト</h1>
      
      <div className="max-w-md mx-auto grid gap-4">
        {/* 3. map関数でリストの人数分、カードを表示する */}
        {OSHI_LIST.map((oshi) => (
          <div key={oshi.id} className="p-4 border rounded-xl bg-white shadow-sm flex justify-between items-center">
            <div>
              <h2 className="font-bold">{oshi.name}</h2>
              <p className="text-sm text-gray-500">
                {results[oshi.id] || "未確認"}
              </p>
            </div>
            
            <button 
              onClick={() => checkLive(oshi.id)}
              disabled={loadingId === oshi.id}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:bg-gray-400"
            >
              {loadingId === oshi.id ? "確認中..." : "確認"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}