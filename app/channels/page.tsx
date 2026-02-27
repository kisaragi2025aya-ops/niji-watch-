"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Oshi {
  id: string;
  name: string;
  image?: string;
}

export default function ChannelsPage() {
  const { data: session } = useSession();
  const [oshiList, setOshiList] = useState<Oshi[]>([]);
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

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

  // 2. YouTube同期実行
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/youtube/sync');
      const data = await res.json();
      if (data.syncedCount !== undefined) {
        alert(`${data.syncedCount}名のライバーを同期しました！`);
      } else {
        alert("同期が完了しました。");
      }
      fetchOshi();
    } catch (error) {
      alert("同期に失敗しました。");
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. 手動追加
  const addOshi = async () => {
    if (!newName || !newId) return;
    await fetch('/api/oshi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: newName })
    });
    setNewName("");
    setNewId("");
    fetchOshi();
  };

  // 4. 削除
  const removeOshi = async (id: string) => {
    if (!confirm(`${oshiList.find(o => o.id === id)?.name} を削除しますか？`)) return;
    await fetch(`/api/oshi?id=${id}`, { method: 'DELETE' });
    fetchOshi();
  };

  return (
    <div className="max-w-md mx-auto space-y-8 p-4">
      {/* YouTube同期セクション */}
      <section className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-6">
        <h2 className="font-bold mb-2 text-white text-lg flex items-center gap-2">
          YouTubeから自動登録
        </h2>
        <p className="text-zinc-400 text-sm mb-4">登録中のにじさんじライバーを自動で抽出します。</p>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`w-full py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${
            isSyncing ? "bg-zinc-700 text-zinc-400" : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          <span>{isSyncing ? "同期中..." : "🔴 YouTubeと同期する"}</span>
        </button>
      </section>

      {/* 手動追加セクション */}
      <section className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="font-bold mb-4 text-white">推しを手動で追加</h2>
        <div className="space-y-3">
          <input
            type="text" placeholder="名前" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text" placeholder="YouTube チャンネルID (UC...)" value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button 
            onClick={addOshi} 
            className="w-full bg-blue-600 py-2 rounded font-bold hover:bg-blue-700 transition"
          >
            追加
          </button>
        </div>
      </section>

      {/* 登録済みリスト */}
      <section>
        <h2 className="font-bold mb-4 text-zinc-400 flex justify-between">
          <span>登録済みリスト</span>
          <span>{oshiList.length}名</span>
        </h2>
        <div className="grid gap-3">
          {oshiList.map((oshi) => (
            <div key={oshi.id} className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition">
              <div className="flex items-center gap-3">
                {oshi.image ? (
                  <img src={oshi.image} alt="" className="w-10 h-10 rounded-full bg-zinc-800" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">No Img</div>
                )}
                <span className="font-medium text-white">{oshi.name}</span>
              </div>
              <button 
                onClick={() => removeOshi(oshi.id)} 
                className="text-zinc-500 hover:text-red-500 transition text-sm p-2"
              >
                削除
              </button>
            </div>
          ))}
          {oshiList.length === 0 && (
            <p className="text-center text-zinc-600 py-10">推しが登録されていません</p>
          )}
        </div>
      </section>
    </div>
  );
}