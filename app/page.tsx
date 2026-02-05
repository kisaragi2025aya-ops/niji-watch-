"use client";
import { useState, useEffect } from "react";
import axios from "axios";

// 1. チェックしたい推しのリスト
const OSHI_LIST = [
  { id: 'UCZf_7m96pylvgOOIDaccEnA', name: 'にじさんじ公式' },
  { id: 'UC_82H3XUnitVGVzWSeL1A1g', name: '壱百満天原サロメ' },
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

  const checkAll = async () => {
    for(const oshi of OSHI_LIST){
      await checkLive(oshi.id);
    }
  };

  useEffect(() => {
    // 1. まず、ページを開いた瞬間に1回チェックする
    checkAll();

    // 2. その後、一定時間おきに自動実行する予約を入れる
    const timer = setInterval(() => {
      console.log("自動チェックを実行します...");
      checkAll();
    }, 60000); // 60000ミリ秒 = 1分

    // 3. ページを閉じた時にタイマーを止める（お片付け）
    return () => clearInterval(timer);
  },[]);

  // 表示用のリストを作成し、配信中の人が上に来るように並び替える
  const sortedOshiList = [...OSHI_LIST].sort((a, b) => {
    const aResult = results[a.id] || "";
    const bResult = results[b.id] || "";

    // aが配信中で、bが配信中でないなら、aを上にする
    if (aResult.includes("🔴") && !bResult.includes("🔴")) return -1;
    // 逆にbが配信中で、aが配信中でないなら、bを上にする
    if (!aResult.includes("🔴") && bResult.includes("🔴")) return 1;
    // それ以外（両方配信中、または両方オフライン）なら順序を変えない
    return 0;
  });

  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">推し生存確認リスト</h1>
      
      <div className="flex justify-center mb-6">
        <button
          onClick={checkAll}
          className="bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-green-700 transition"
        >
          🔃 全員の配信状況を一括確認
        </button>
      </div>

      <div className="max-w-md mx-auto grid gap-4">
        {/* 3. map関数でリストの人数分、カードを表示する */}
        {/* 修正前：OSHI_LIST.map((oshi) => ( */}
      {sortedOshiList.map((oshi) => (
        <div 
          key={oshi.id} 
          // 🔴 ライブ配信中！ という文字が含まれていたら 背景を orange-50 に、そうでなければ white にする
          className={`mb-4 p-4 border rounded shadow-sm flex items-center justify-between ${
          (results[oshi.id] || "").includes("🔴") ? "bg-orange-50 border-orange-200" : "bg-white"
          }`}
        >
          <div>
            <h2 className="text-xl font-bold text-black">{oshi.name}</h2>
            <p className="text-gray-700 font-medium">
              {results[oshi.id] || "未確認"}
            </p>
          </div>

          <button
            onClick={() => checkLive(oshi.id)}
            disabled={loadingId === oshi.id}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loadingId === oshi.id ? "確認中..." : "確認"}
          </button>
        </div>
      ))}
      </div>
    </main>
  );
}