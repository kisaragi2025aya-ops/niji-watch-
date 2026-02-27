import { PrismaClient } from "@prisma/client";
import { judgeCategory } from "../lib/constants"; // 🌟 パスは環境に合わせて調整してください
const prisma = new PrismaClient();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function fetchAllVideosForChannel(channelId: string) {
  const uploadsId = channelId.replace(/^UC/, "UU");
  let nextPageToken = "";
  let totalSaved = 0;

  console.log(`\n📺 Scanning Channel: ${channelId}`);

  try {
    do {
      const url: string = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.items || data.items.length === 0) break;

      const videoIds = data.items.map((item: any) => item.snippet.resourceId.videoId).join(",");
      
      const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
      const statsData = await statsRes.json();

      if (statsData.items) {
        await Promise.all(statsData.items.map(async (v: any) => {
          // 🌟 ポイント1: 改良した judgeCategory を使って複数のタグ（配列）を取得
          const categories = judgeCategory(v.snippet.title);

          await prisma.cachedVideo.upsert({
            where: { id: v.id },
            update: { 
              viewCount: v.statistics.viewCount || "0",
              title: v.snippet.title,
              categories: categories // 🌟 ポイント2: categories (配列) を更新
            },
            create: {
              id: v.id,
              title: v.snippet.title,
              thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url || "",
              channelTitle: v.snippet.channelTitle,
              channelId: v.snippet.channelId,
              categories: categories, // 🌟 ポイント3: categories (配列) で作成
              publishedAt: new Date(v.snippet.publishedAt),
              duration: v.contentDetails.duration,
              viewCount: v.statistics.viewCount || "0",
            }
          });
        }));
        totalSaved += statsData.items.length;
        process.stdout.write(`\r   -> Cached ${totalSaved} videos total...`);
      }

      nextPageToken = data.nextPageToken;

      // APIクォータ（1日の制限）を使い切らないよう、1000件程度で止めるのは良い判断です
      if (totalSaved >= 1000) break;

    } while (nextPageToken);

  } catch (error) {
    console.error(`\n❌ Error on channel ${channelId}:`, error);
  }
}

async function main() {
  const allOshi = await prisma.oshi.findMany({
    select: { id: true },
    distinct: ['id']
  });

  console.log(`🚀 Starting data sync for ${allOshi.length} unique channels...`);

  for (const oshi of allOshi) {
    await fetchAllVideosForChannel(oshi.id);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n\n✅ Cache Update Completed!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());