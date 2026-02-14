// app/page.tsx
"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // ログイン済みなら、自動的に配信一覧ページへ移動させる
    useEffect(() => {
        if (status === "authenticated") {
            router.push("/feed");
        }
    }, [status, router]);

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>;
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <h1 className="text-4xl font-extrabold mb-6 tracking-tighter">
                自分専用の <span className="text-blue-500">にじウォッチ</span>
            </h1>
            <p className="text-zinc-400 mb-10 max-w-md">
                YouTubeの登録チャンネルから、あなたの推しの配信状況だけを自動でピックアップ。
            </p>

            {!session && (
                <button
                    onClick={() => signIn("google", { callbackUrl: "/feed" })} // ログイン後に /feed へ飛ばす設定
                    className="..."
                >
                    Googleでログインして始める
                </button>
            )}
        </main>
    );
}