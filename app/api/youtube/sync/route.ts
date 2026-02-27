import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NIJISANJI_CHANNELS, judgeCategory } from "@/lib/constants";

const prisma = new PrismaClient();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * チャンネル同期時に全動画を取得してキャッシュする関数
 */
async function syncAllVideosForChannel(channelId: string) {
  const uploadsId = channelId.replace(/^UC/, "UU");
  let nextPageToken = "";
  try {
    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.items || data.items.length === 0) break;

      const videoIds = data.items.map((item: any) => item.snippet.resourceId.videoId).join(",");
      const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
      const statsData = await statsRes.json();

      if (statsData.items) {
        await Promise.all(statsData.items.map(async (v: any) => {
          // lib/constants.ts の辞書に基づきカテゴリ判定
          const category = judgeCategory(v.snippet.title);

          await prisma.cachedVideo.upsert({
            where: { id: v.id },
            update: { 
              viewCount: v.statistics.viewCount || "0",
              category: category 
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
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);
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

  // constants.ts から ID セットを作成
  const nijiIds = new Set(NIJISANJI_CHANNELS.map(c => c.id));
  let allSubscriptions: any[] = [];
  let nextPageToken = "";

  try {
    // 1. YouTubeから登録情報を全取得
    do {
      const url: string = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${
        nextPageToken ? `&pageToken=${nextPageToken}` : ""
      }`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();

      if (data.items) {
        allSubscriptions = [...allSubscriptions, ...data.items];
      }
      nextPageToken = data.nextPageToken || "";
    } while (nextPageToken);

    // 2. にじさんじのみにフィルタ
    const myOshiInNijisanji = allSubscriptions
      .map((item: any) => ({
        id: item.snippet.resourceId.channelId,
        name: item.snippet.title,
        image: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      }))
      .filter((channel) => nijiIds.has(channel.id));

    // 3. DB保存
    const results = await Promise.all(
      myOshiInNijisanji.map((oshi) =>
        prisma.oshi.upsert({
          where: {
            id_userEmail: { id: oshi.id, userEmail: session.user?.email || "" }
          },
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

    // 同期したライバーの動画をバックグラウンドで収集
    results.forEach(oshi => {
      syncAllVideosForChannel(oshi.id);
    });

    return NextResponse.json({
      message: "Sync complete!",
      totalChecked: allSubscriptions.length,
      syncedCount: results.length,
      syncedNames: results.map(r => r.name)
    });

  } catch (error: any) {
    console.error("❌ Sync Error:", error);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}