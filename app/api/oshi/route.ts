export const dynamic = 'force-dynamic';
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";
import { judgeCategory } from "@/lib/constants"; // 作成した共通関数をインポート

const prisma = new PrismaClient();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * チャンネル追加時に全動画を取得してキャッシュする関数
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
          // 【重要】lib/constants.ts の辞書ルールに基づいてカテゴリを決定
          const category = judgeCategory(v.snippet.title);

          await prisma.cachedVideo.upsert({
            where: { id: v.id },
            update: { 
              viewCount: v.statistics.viewCount || "0",
              category: category // カテゴリ判定も最新の辞書で更新
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
    console.log(`✅ Finished caching for channel: ${channelId}`);
  } catch (error) {
    console.error(`❌ Error syncing videos for ${channelId}:`, error);
  }
}

// 取得 (GET)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json([], { status: 401 });
  
  const oshiList = await prisma.oshi.findMany({ 
    where: { userEmail: session.user.email },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(oshiList);
}

// 追加 (POST)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { id, name, image } = await req.json();
  
  const result = await prisma.oshi.upsert({
    where: { id_userEmail: { id, userEmail: session.user.email } },
    update: { 
      name,
      image: image || undefined 
    },
    create: { 
      id, 
      name, 
      userEmail: session.user.email,
      image: image || null 
    },
  });

  // バックグラウンドで辞書に基づいた全動画取得を開始
  syncAllVideosForChannel(id);

  return NextResponse.json(result);
}

// 削除 (DELETE)
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!session?.user?.email || !id) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  await prisma.oshi.delete({
    where: { id_userEmail: { id, userEmail: session.user.email } }
  });
  return NextResponse.json({ success: true });
}