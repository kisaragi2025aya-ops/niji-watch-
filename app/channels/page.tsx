// app/channels/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ChannelsPage() {
  const { data: session } = useSession();
  const [oshiList, setOshiList] = useState<{ id: string, name: string }[]>([]);
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");

  useEffect(() => {
    if (session?.user?.email) {
      const userKey = `myOshiList_${session.user.email}`;
      const saved = localStorage.getItem(userKey);
      if (saved) setOshiList(JSON.parse(saved));
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user?.email) {
      const userKey = `myOshiList_${session.user.email}`;
      localStorage.setItem(userKey, JSON.stringify(oshiList));
    }
  }, [oshiList, session?.user?.email]);

  const addOshi = () => {
    if (!newName || !newId) return;
    setOshiList([...oshiList, { id: newId, name: newName }]);
    setNewName("");
    setNewId("");
  };

  const removeOshi = (id: string) => {
    setOshiList(oshiList.filter(oshi => oshi.id !== id));
  };

  return (
    <div className="max-w-md mx-auto space-y-8">
      <section className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="font-bold mb-4 text-white">推しを手動で追加</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="名前"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white"
          />
          <input
            type="text"
            placeholder="YouTube チャンネルID"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white"
          />
          <button onClick={addOshi} className="w-full bg-blue-600 py-2 rounded font-bold hover:bg-blue-700">追加</button>
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-4 text-zinc-400">登録済みリスト ({oshiList.length})</h2>
        <div className="space-y-2">
          {oshiList.map((oshi) => (
            <div key={oshi.id} className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg border border-zinc-800">
              <span className="font-medium">{oshi.name}</span>
              <button onClick={() => removeOshi(oshi.id)} className="text-red-500 text-sm hover:underline">削除</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}