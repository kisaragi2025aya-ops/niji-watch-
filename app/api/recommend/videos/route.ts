import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ==========================================
// 1. タグ辞書システム (検索ワードとブースト)
// keywords: YouTube検索に使う単語
// ==========================================
const TAG_DICTIONARY: { [key: string]: { keywords: string[] } } = {
    "雑談": { keywords: ["雑談", "凸待ち", "飲み枠", "作業用"] },
    "歌枠": { keywords: ["歌枠", "歌ってみた", "SINGING", "KARAOKE"] },
    "FPS": { keywords: ["VALORANT", "Apex", "オーバーウォッチ", "ストグラ"] },
    "原神": { keywords: ["原神", "Genshin", "テイワット", "螺旋"] },
    "3Dライブ": { keywords: ["3Dライブ", "3D配信", "記念配信"] },
    "ASMR": { keywords: ["ASMR", "バイノーラル", "囁き"] },
    "麻雀": { keywords: ["雀魂", "麻雀", "段位戦"] },
    "ホラー": { keywords: ["ホラーゲーム", "地獄銭湯", "影廊"] },
    // 今後ここを自由に追加してください
};

// ==========================================
// 2. 高度なスコアリング関数
// ==========================================
function calculateAdvancedScore(video: any, tag: string, userScores: Record<string, number>, isSelected: boolean) {
    let score = 0;

    // ① 注目度 (再生数) - 対数スケールで加点
    const views = parseInt(video.statistics?.viewCount || "0");
    score += Math.log10(views + 1) * 5;

    // ② 新しさ (30日以内なら加点、新しいほど高い)
    const publishedAt = new Date(video.snippet.publishedAt).getTime();
    const diffDays = (Date.now() - publishedAt) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - diffDays) * 1.5;

    // ③ ユーザーの好み (蓄積スコア)
    const tagBaseScore = userScores[tag] || 0;
    score += tagBaseScore * 0.5;

    // ④ 今日の気分 (アンケートで選ばれていたら大幅加点)
    if (isSelected) score += 50;

    // ⑤ ノイズ減点 (切り抜き対策)
    if (video.snippet.title.includes("切り抜き")) score -= 100;

    return score;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const [prefs, oshiList] = await Promise.all([
            prisma.userPreference.findUnique({ where: { userEmail: session.user.email } }),
            prisma.oshi.findMany({ where: { userEmail: session.user.email } })
        ]);

        if (!prefs) return NextResponse.json({ genres: [] });

        const channelIds = oshiList.map(o => o.id).join(",");
        const userScores = (prefs.tagScores as Record<string, number>) || {};
        const selectedToday = prefs.interests || [];

        // --- ジャンル選定ロジック ---
        // 1. スコア上位3つのタグを抽出
        const sortedTags = Object.keys(TAG_DICTIONARY)
            .sort((a, b) => (userScores[b] || 0) - (userScores[a] || 0))
            .slice(0, 3);

        // 2. ランダムな発見枠（上位3つ以外から1つ）
        const remainingTags = Object.keys(TAG_DICTIONARY).filter(t => !sortedTags.includes(t));
        const randomTag = remainingTags[Math.floor(Math.random() * remainingTags.length)];

        const targetTags = [...sortedTags, randomTag];

        const genreResults = await Promise.all(
            targetTags.map(async (tag) => {
                const dict = TAG_DICTIONARY[tag];
                const query = dict.keywords.join(" OR ");

                // 検索実行
                const searchRes = await fetch(
                    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelIds}&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`
                );
                const searchData = await searchRes.json();

                // 動画が見つからない場合の早期リターン
                if (!searchData.items || searchData.items.length === 0) {
                    return { genre: tag, items: [] };
                }

                const videoIds = searchData.items.map((v: any) => v.id.videoId).join(",");

                // 詳細（再生数など）を取得
                const statsRes = await fetch(
                    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
                );
                const statsData = await statsRes.json();

                // スコア計算
                const scoredVideos = (statsData.items || [])
                    .map((v: any) => ({
                        id: v.id, // ここが v.id.videoId ではなく v.id になる点に注意
                        title: v.snippet.title,
                        thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url,
                        channelTitle: v.snippet.channelTitle,
                        totalScore: calculateAdvancedScore(v, tag, userScores, selectedToday.includes(tag))
                    }))
                    .sort((a: any, b: any) => b.totalScore - a.totalScore)
                    .slice(0, 4);

                return {
                    genre: tag,
                    items: scoredVideos
                };
            })
        );

        return NextResponse.json({ genres: genreResults });
    } catch (error) {
        console.error("Selection Algorithm Error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}