export const dynamic = 'force-dynamic'; // これを追加

import { NextResponse } from 'next/server';
// ...他のインポート
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { judgeCategory } from "@/lib/constants";

const prisma = new PrismaClient();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function GET(req: Request) {
  // セキュリティ対策：外部から勝手に叩かれないよう、Cron専用の認証を行うことが推奨されます
  // ※ Vercel Cronなどを使用する場合は、Authorizationヘッダーのチェックなどをここに追加します

  try {
    // 1. DBに登録されているユニークな全チャンネルIDを取得
    const oshiList = await prisma.oshi.findMany({
      select: { id: true },
      distinct: ['id'],
    });

    console.log(`[Cron] Starting update for ${oshiList.length} channels...`);

    for (const oshi of oshiList) {
      const uploadsId = oshi.id.replace(/^UC/, "UU");
      
      // 2. YouTube APIで最新の50件を取得
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(playlistUrl);
      const data = await res.json();

      if (!data.items || data.items.length === 0) continue;

      const videoIds = data.items.map((item: any) => item.snippet.resourceId.videoId).join(",");
      
      // 3. 動画の統計情報と詳細（カテゴリ判定用）を取得
      const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
      const statsData = await statsRes.json();

      if (statsData.items) {
        await Promise.all(statsData.items.map(async (v: any) => {
          const category = judgeCategory(v.snippet.title);

          // すでにDBにあるものは無視し、新しいものだけを作成、再生数は更新
          await prisma.cachedVideo.upsert({
            where: { id: v.id },
            update: { 
              viewCount: v.statistics.viewCount || "0",
              category: category // 辞書が変わった時のために更新
            },
            create: {
              id: v.id,
              title: v.snippet.title,
              thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url || "",
              channelTitle: v.snippet.channelTitle,
              channelId: v.snippet.channelId,
              category: category,
              publishedAt: new Date(v.snippet.publishedAt),
              duration: v.contentDetails.duration,
              viewCount: v.statistics.viewCount || "0",
            }
          });
        }));
      }
      // API制限を考慮し、少しだけ待機（必要に応じて）
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return NextResponse.json({ success: true, message: "Update completed" });
  } catch (error) {
    console.error("[Cron Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}