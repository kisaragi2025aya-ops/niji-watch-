import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { TAG_DICTIONARY } from "@/lib/constants";

const prisma = new PrismaClient();

// 🌟 重要: キャッシュを無効化し、リロードのたびに必ず計算させる
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tagsParam = searchParams.get("tags");

    if (!tagsParam) {
      await prisma.userPreference.deleteMany({
        where: { userEmail: session.user.email }
      });

      const allTagNames = Object.keys(TAG_DICTIONARY || {});
      const shuffled = allTagNames
        .sort(() => 0.5 - Math.random())
        .slice(0, 15);

      return NextResponse.json({
        mode: "survey",
        tags: shuffled
      });
    }

    // 1. タグを保存（上書き）
    const chosenTags = tagsParam.split(",").filter(Boolean);
    const prefs = await prisma.userPreference.upsert({
      where: { userEmail: session.user.email },
      update: { interests: chosenTags, lastSurveyAt: new Date() },
      create: { userEmail: session.user.email, interests: chosenTags },
    });

    // 2. おすすめ動画を取得（ハイブリッド構成）
    const selectedGenres = prefs.interests.slice(0, 5);
    const usedVideoIds = new Set<string>();

    const genres = await Promise.all(
      selectedGenres.map(async (genreName) => {
        // --- A. 新着枠（最新から20件だけ候補を取る） ---
        const recentItems = await prisma.cachedVideo.findMany({
          where: { categories: { has: genreName } },
          take: 10,
          orderBy: { publishedAt: 'desc' }
        });

        // --- B. アーカイブ枠（ランダムな期間を狙い撃ち） ---
        const totalCount = await prisma.cachedVideo.count({
          where: { categories: { has: genreName } }
        });

        // 全件のどこからでも開始できるようにランダム値を生成
        // Math.random() はリロードのたびに変わるので、ここが「同じ動画」を防ぐ鍵です
        const randomStart = Math.floor(Math.random() * Math.max(0, totalCount - 40));

        const archiveItems = await prisma.cachedVideo.findMany({
          where: { categories: { has: genreName } },
          take: 50,
          skip: randomStart,
          // あえてID順などで取得することでランダム位置からの連続性を保ちつつ
          // publishedAt に縛られないようにします
        });

        // 候補を合体
        const combinedRaw = [...recentItems, ...archiveItems];

        const filteredItems: any[] = [];
        const channelCounts: Record<string, number> = {};

        // リスト自体をさらに混ぜてから選別する
        const shuffledRaw = combinedRaw.sort(() => 0.5 - Math.random());

        for (const item of shuffledRaw) {
          if (usedVideoIds.has(item.id)) continue;

          const cid = item.channelId;
          channelCounts[cid] = (channelCounts[cid] || 0) + 1;

          if (channelCounts[cid] <= 2) {
            filteredItems.push(item);
            usedVideoIds.add(item.id);
          }

          if (filteredItems.length >= 8) break;
        }

        return {
          genre: genreName,
          items: filteredItems
        };
      })
    );

    return NextResponse.json({
      mode: "recommend",
      genres: genres.filter(g => g.items.length > 0)
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ mode: "recommend", genres: [] }, { status: 500 });
  }
}