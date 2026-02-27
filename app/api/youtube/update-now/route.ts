import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { judgeCategory } from "@/lib/constants";

const prisma = new PrismaClient();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function GET() {
  try {
    // 1. DBに登録されているユニークな全チャンネルIDを取得
    const oshiList = await prisma.oshi.findMany({
      select: { id: true, name: true },
      distinct: ['id'],
    });

    if (oshiList.length === 0) {
      return NextResponse.json({ 
        message: "登録されているライバーがいません。先にライバーを登録または同期してください。" 
      });
    }

    console.log(`[Manual Update] ${oshiList.length}名の更新を開始します...`);
    let totalUpdated = 0;

    // 2. 各ライバーの最新動画（最大20件ずつ）を巡回
    for (const oshi of oshiList) {
      const uploadsId = oshi.id.replace(/^UC/, "UU");
      
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=20&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(playlistUrl);
      const data = await res.json();

      if (!data.items || data.items.length === 0) continue;

      const videoIds = data.items.map((item: any) => item.snippet.resourceId.videoId).join(",");
      
      // 動画の詳細を取得
      const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
      const statsData = await statsRes.json();

      if (statsData.items) {
        for (const v of statsData.items) {
          // 🌟 修正ポイント: 改良した judgeCategory は String[] を返すようになっています
          const categories = judgeCategory(v.snippet.title);

          await prisma.cachedVideo.upsert({
            where: { id: v.id },
            update: { 
              viewCount: v.statistics.viewCount || "0",
              categories: categories // 🌟 categories に配列を入れる
            },
            create: {
              id: v.id,
              title: v.snippet.title,
              thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url || "",
              channelTitle: v.snippet.channelTitle,
              channelId: v.snippet.channelId,
              categories: categories, // 🌟 categories に配列を入れる
              publishedAt: new Date(v.snippet.publishedAt),
              duration: v.contentDetails.duration,
              viewCount: v.statistics.viewCount || "0",
            }
          });
          totalUpdated++;
        }
      }
      // API制限対策で一瞬待機
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return NextResponse.json({ 
      success: true, 
      message: `${oshiList.length}名のライバーから最新動画を更新・再分類しました。`,
      totalVideosProcessed: totalUpdated
    });

  } catch (error) {
    console.error("[Manual Update Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}