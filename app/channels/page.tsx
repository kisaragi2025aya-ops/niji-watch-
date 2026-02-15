"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ChannelsPage() {
  const { data: session } = useSession();
  const [oshiList, setOshiList] = useState<{ id: string, name: string }[]>([]);
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");

  // 1. ページ読み込み時にDBからリストを取得
  const fetchOshi = async () => {
    try {
      const res = await fetch('/api/oshi');
      const data = await res.json();
      setOshiList(data);
    } catch (error) {
      console.error("読み込み失敗:", error);
    }
  };

  useEffect(() => {
    if (session) fetchOshi();
  }, [session]);

  // 2. 手動追加（APIを叩いてDBに保存）
  const addOshi = async () => {
    if (!newName || !newId) return;
    
    // 同期用のAPIロジックを流用して、この一人だけをDBに送る
    // (今回は簡易的に、現在の同期APIの仕組みに合わせます)
    await fetch('/api/oshi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: newName })
    });

    setNewName("");
    setNewId("");
    fetchOshi(); // リスト再取得
  };

  // 3. 削除（APIを叩いてDBから消す）
  const removeOshi = async (id: string) => {
    await fetch(`/api/oshi?id=${id}`, { method: 'DELETE' });
    fetchOshi(); // リスト再取得
  };

  return (
    <div className="max-w-md mx-auto space-y-8">
      {/* YouTube同期セクション */}
      <section className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-6">
        <h2 className="font-bold mb-2 text-white text-lg">YouTubeから自動登録</h2>
        <p className="text-zinc-400 text-sm mb-4">登録中のにじさんじライバーを自動で見つけます。</p>
        <button
          onClick={async () => {
            const res = await fetch('/api/youtube/sync');
            const data = await res.json();
            alert(`${data.count}名のライバーを同期しました！`);
            fetchOshi(); // window.location.reload()の代わりに再取得
          }}
          className="w-full bg-red-600 py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center justify-center gap-2"
        >
          <span>🔴 YouTubeと同期する</span>
        </button>
      </section>

      {/* 手動追加セクション */}
      <section className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="font-bold mb-4 text-white">推しを手動で追加</h2>
        <div className="space-y-3">
          <input
            type="text" placeholder="名前" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white"
          />
          <input
            type="text" placeholder="YouTube チャンネルID" value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white"
          />
          <button onClick={addOshi} className="w-full bg-blue-600 py-2 rounded font-bold hover:bg-blue-700">追加</button>
        </div>
      </section>

      {/* 登録済みリスト */}
      <section>
        <h2 className="font-bold mb-4 text-zinc-400">登録済みリスト ({oshiList.length})</h2>
        <div className="space-y-2">
          {oshiList.map((oshi) => (
            <div key={oshi.id} className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg border border-zinc-800">
              <span className="font-medium text-white">{oshi.name}</span>
              <button onClick={() => removeOshi(oshi.id)} className="text-red-500 text-sm hover:underline">削除</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}