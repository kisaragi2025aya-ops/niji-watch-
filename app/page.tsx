"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  // 2. 結果を保存する「Map」のような状態
  const { data: session } = useSession();
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [oshiList, setOshiList] = useState<{ id: string, name: string }[]>([]);

  // 1. 読み込み部分
  useEffect(() => {
    // ログインしている時だけ実行
    if (session?.user?.email) {
      // 保存キーにメールアドレスを混ぜる (例: myOshiList_test@gmail.com)
      const userKey = `myOshiList_${session.user.email}`;
      const saved = localStorage.getItem(userKey);

      if (saved) {
        setOshiList(JSON.parse(saved));
      }
    }
  }, [session?.user?.email]); // ログインした瞬間に読み込むようにする

  // 2. 保存部分
  useEffect(() => {
    if (session?.user?.email && oshiList.length > 0) {
      const userKey = `myOshiList_${session.user.email}`;
      localStorage.setItem(userKey, JSON.stringify(oshiList));
    }
  }, [oshiList, session?.user?.email]); // リストが変わるか、ユーザーが変わったら保存

  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const prevLengthRef = useRef(oshiList.length);

  const addOshi = () => {
    if (!newName || !newId) return;
    setOshiList([...oshiList, { id: newId, name: newName }]);
    setNewName("");
    setNewId("");
  };

  const removeOshi = (id: string) => {
    setOshiList(oshiList.filter(oshi => oshi.id !== id));
  };

  // --- 修正版：一括チェック関数 ---
  const checkAll = async () => {
    if (oshiList.length === 0) return;

    const newResults: { [key: string]: string } = {};

    // 全員のチェックを並行して実行（爆速です）
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

  // 個別チェックも一括チェックの仕組みを再利用するように簡略化
  const checkLive = async (channelId: string) => {
    setLoadingId(channelId);
    await checkAll(); // 今回は一括が速いので、個別でも全体を更新しちゃいます
    setLoadingId(null);
  };

  useEffect(() => {
    // 1. 初回起動時か、人数が増えた時だけチェックを実行
    if (oshiList.length > prevLengthRef.current) {
      console.log("人数が増えたので一括確認します");
      checkAll();
    }

    // 2. 今の人数を「次回の比較用」に保存しておく
    prevLengthRef.current = oshiList.length;

    // 3. その後、一定時間おきに自動実行する予約を入れる
    const timer = setInterval(() => {
      console.log("自動チェックを実行します...");
      checkAll();
    }, 60000); // 60000ミリ秒 = 1分

    // 4. ページを閉じた時にタイマーを止める（お片付け）
    return () => clearInterval(timer);
  }, [oshiList.length]);


  // 表示用のリストを作成し、配信中の人が上に来るように並び替える
  const sortedOshiList = [...oshiList].sort((a, b) => {
    const aResult = results[a.id] || "";
    const bResult = results[b.id] || "";

    // aが配信中で、bが配信中でないなら、aを上にする
    if (aResult.includes("🔴") && !bResult.includes("🔴")) return -1;
    // 逆にbが配信中で、aが配信中でないなら、bを上にする
    if (!aResult.includes("🔴") && bResult.includes("🔴")) return 1;
    // それ以外（両方配信中、または両方オフライン）なら順序を変えない
    return 0;
  });

  // ログインしていない時の表示
  if (!session) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">推し配信状況確認リスト</h1>
        <button
          onClick={() => signIn("google")}
          className="bg-white text-gray-700 border p-3 rounded shadow hover:bg-gray-100"
        >
          Googleでログインして始める
        </button>
      </main>
    );
  }

  return (
    <main className=" bg-gray-50 min-h-screen">

      <div className="w-full bg-indigo-100 mb-8 flex items-center relative shadow-sm h-24">

        {/* タイトル：これを「absolute」にすることで、ブロックを無視して画面のド真ん中に来ます */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h1 className="text-3xl font-bold text-indigo-900 whitespace-nowrap">
            推し配信状況確認リスト
          </h1>
        </div>

        {/* 右側のブロック：ml-auto で右端にピタッとくっつきます */}
        <div className="ml-auto bg-indigo-200 pl-8 pr-6 h-full flex flex-col items-end justify-center shadow-inner">
          <div className="flex items-center gap-3">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt="User Icon"
                className="w-8 h-8 rounded-full border-2 border-white"
              />
            )}
            <span className="font-bold text-gray-800 text-sm whitespace-nowrap">
              {session.user?.name}さん
            </span>
          </div>
          <div className="mt-0.5">
            <button
              onClick={() => signOut()}
              className="text-[10px] font-bold text-indigo-500 hover:text-red-500 underline"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>

      {/* --- 追加フォーム --- */}
      <div className="max-w-md mx-auto mb-10 p-6 bg-white rounded-xl shadow-md border border-gray-200">
        <h3 className="font-bold mb-3 text-gray-700">新しい推しを手動で追加</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="名前（例：アンジュ・カトリーナ）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full p-2 border rounded text-black bg-white"
          />
          <input
            type="text"
            placeholder="YouTube チャンネルID（UC...）"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="w-full p-2 border rounded text-black bg-white"
          />
          <button
            onClick={addOshi}
            className="w-full bg-indigo-600 text-white font-bold py-2 rounded hover:bg-indigo-700 transition"
          >
            リストに追加
          </button>
        </div>
      </div>

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
        {/* --- 修正後のカード部分 --- */}

        {sortedOshiList.map((oshi) => {
          const isLive = (results[oshi.id] || "").includes("🔴");

          return (
            <div
              key={oshi.id}
              className={`mb-4 p-4 border rounded shadow-sm flex items-center justify-between transition-all duration-200 hover:shadow-md hover:scale-[1.01] cursor-pointer ${isLive ? "bg-orange-50 border-orange-200" : "bg-white hover:bg-gray-50"
                }`}
              onClick={() => window.open(`https://www.youtube.com/channel/${oshi.id}/live`, '_blank')}
            >
              <div className="flex-grow">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-black">{oshi.name}</h2>
                  {/* AIレコメンド機能を追加した時に「おすすめ！」バッジなどを出す場所の予約 */}
                  {/* {isRecommended && <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold">AI推し！</span>} */}
                </div>
                <p className={`font-medium ${isLive ? "text-orange-600" : "text-gray-500"}`}>
                  {results[oshi.id] || "未確認"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* 配信中なら「視聴する」、オフラインなら「chへ移動」と表示を変えて親切に */}
                <span className={`text-sm font-bold px-3 py-1 rounded-full border ${isLive ? "border-orange-500 text-orange-600 animate-pulse" : "border-gray-300 text-gray-400"
                  }`}>
                  {isLive ? "LIVE視聴" : "チャンネルへ"}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    checkLive(oshi.id);
                  }}
                  disabled={loadingId === oshi.id}
                  className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 text-sm"
                >
                  {loadingId === oshi.id ? "..." : "更新"}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeOshi(oshi.id);
                  }}
                  className="text-red-300 text-xs hover:text-red-500"
                >
                  削除
                </button>
              </div>
            </div>
          );
        })}

      </div>
    </main >
  );
}