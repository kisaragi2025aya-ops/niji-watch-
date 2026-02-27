export const dynamic = 'force-dynamic';
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NIJISANJI_CHANNELS, judgeCategory } from "@/lib/constants";

const prisma = new PrismaClient();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * チャンネルの最新1件のみを取得して更新する軽量版関数
 */
async function syncLatestVideoForChannel(channelId: string) {
  const uploadsId = channelId.replace(/^UC/, "UU");
  try {
    // 最新1件だけ取得
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=1&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.items || data.items.length === 0) return;

    const videoId = data.items[0].snippet.resourceId.videoId;
    
    // 動画の詳細（配信ステータス）を取得
    const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`);
    const statsData = await statsRes.json();

    if (statsData.items && statsData.items[0]) {
      const v = statsData.items[0];
      const category = judgeCategory(v.snippet.title);
      
      // サムネイルの決定（ライブ中はlive用サムネを優先）
      const isLive = v.liveStreamingDetails && v.liveStreamingDetails.actualStartTime && !v.liveStreamingDetails.actualEndTime;
      const thumbnail = isLive 
        ? `https://i.ytimg.com/vi/${v.id}/hqdefault_live.jpg`
        : (v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url || "");

      await prisma.cachedVideo.upsert({
        where: { id: v.id },
        update: { 
          title: v.snippet.title,
          thumbnail: thumbnail,
          viewCount: v.statistics.viewCount || "0",
          categories: category 
        },
        create: {
          id: v.id,
          title: v.snippet.title,
          thumbnail: thumbnail,
          channelTitle: v.snippet.channelTitle,
          channelId: v.snippet.channelId,
          categories: category,
          publishedAt: new Date(v.snippet.publishedAt),
          duration: v.contentDetails.duration,
          viewCount: v.statistics.viewCount || "0",
        }
      });
    }
  } catch (error) {
    console.error(`❌ Error syncing videos for ${channelId}:`, error);
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  // @ts-ignore
  const accessToken = session?.accessToken;

  if (!accessToken || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nijiIds = new Set(NIJISANJI_CHANNELS.map(c => c.id));
  let allSubscriptions: any[] = [];
  let nextPageToken = "";

  try {
    // 1. YouTube登録情報を取得
    do {
      const url: string = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${
        nextPageToken ? `&pageToken=${nextPageToken}` : ""
      }`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();
      if (data.items) allSubscriptions = [...allSubscriptions, ...data.items];
      nextPageToken = data.nextPageToken || "";
    } while (nextPageToken);

    const myOshiInNijisanji = allSubscriptions
      .map((item: any) => ({
        id: item.snippet.resourceId.channelId,
        name: item.snippet.title,
        image: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      }))
      .filter((channel) => nijiIds.has(channel.id));

    // 2. Oshiテーブルを更新
    const results = await Promise.all(
      myOshiInNijisanji.map((oshi) =>
        prisma.oshi.upsert({
          where: { id_userEmail: { id: oshi.id, userEmail: session.user?.email || "" } },
          update: { name: oshi.name, image: oshi.image },
          create: {
            id: oshi.id,
            name: oshi.name,
            userEmail: session.user?.email || "",
            image: oshi.image
          },
        })
      )
    );

    // 3. 動画同期（ここを順番待ちにする）
    console.log(`Starting light-sync for ${results.length} channels...`);
    for (const oshi of results) {
      await syncLatestVideoForChannel(oshi.id);
      // DBへの負荷軽減のため、1件ごとに0.1秒だけ待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      message: "Light sync complete!",
      syncedCount: results.length
    });

  } catch (error: any) {
    console.error("❌ Sync Error:", error);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}