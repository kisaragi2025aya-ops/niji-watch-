"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 1. ログイン済みなら自動的に /feed へ移動
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/feed");
    }
  }, [status, router]);

  // 読み込み中の表示
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-[90vh] overflow-hidden">
      {/* 背景の装飾（未来感のある光の演出） */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] -z-10" />
      
      <div className="max-w-2xl px-6 text-center space-y-8">
        {/* ロゴ・タイトル */}
        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px] font-black tracking-[0.2em] uppercase mb-4 animate-bounce">
            Next-Gen Dashboard
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase">
            NIJI <span className="text-blue-600 text-glow">WATCH</span>
          </h1>
          <p className="text-zinc-400 md:text-lg font-medium leading-relaxed max-w-lg mx-auto">
            YouTubeから推しの配信を自動抽出。<br />
            あなただけの「にじさんじ」専用フィードを。
          </p>
        </div>

        {/* ログインボタン */}
        {!session && (
          <div className="flex flex-col items-center gap-4 pt-4">
            <button
              onClick={() => signIn("google", { callbackUrl: "/feed" })}
              className="group relative flex items-center gap-3 px-8 py-4 bg-white text-black font-black rounded-2xl hover:bg-blue-50 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5" />
              Googleアカウントで開始
              <span className="absolute -right-2 -top-2 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-600 border-2 border-white"></span>
              </span>
            </button>
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
              Securely connected via YouTube API
            </p>
          </div>
        )}

        {/* 特徴のチラ見せ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-zinc-900">
          {[
            { label: "Sync", desc: "登録チャンネルから自動同期" },
            { label: "Live", desc: "配信中をリアルタイム検知" },
            { label: "Learn", desc: "好みをAIが学習・推薦" }
          ].map((feature, i) => (
            <div key={i} className="space-y-1">
              <div className="text-blue-500 font-black italic text-xs uppercase tracking-tighter">{feature.label}</div>
              <div className="text-zinc-500 text-[11px] font-bold">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .text-glow {
          text-shadow: 0 0 20px rgba(37, 99, 235, 0.5);
        }
      `}</style>
    </main>
  );
}