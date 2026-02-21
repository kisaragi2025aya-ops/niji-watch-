import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const TAG_DICTIONARY: { [key: string]: { keywords: string[] } } = {
    "雑談": { keywords: ["雑談", "凸待ち", "飲み枠", "作業用"] },
    "歌枠": { keywords: ["歌枠", "歌ってみた", "SINGING", "KARAOKE"] },
    "FPS": { keywords: ["VALORANT", "Apex", "オーバーウォッチ", "ストグラ"] },
    "原神": { keywords: ["原神", "Genshin", "テイワット", "螺旋"] },
    "3Dライブ": { keywords: ["3Dライブ", "3D配信", "記念配信"] },
    "ASMR": { keywords: ["ASMR", "バイノーラル", "囁き"] },
    "麻雀": { keywords: ["雀魂", "麻雀", "段位戦"] },
    "ホラー": { keywords: ["ホラーゲーム", "地獄銭湯", "影廊"] },
};

function calculateAdvancedScore(video: any, tag: string, userScores: Record<string, number>, isSelected: boolean) {
    let score = 0;

    // ① 基本要素 (再生数・新しさ)
    const views = parseInt(video.statistics?.viewCount || "0");
    score += Math.log10(views + 1) * 5;
    const diffDays = (Date.now() - new Date(video.snippet.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - diffDays) * 1.5;

    // ② ジャンルの好み
    score += (userScores[tag] || 0) * 0.5;
    if (isSelected) score += 50;

    // ③ ★隠しパラメータの反映 (形態・時間・シリーズ)
    const title = video.snippet.title;
    const mins = parseDuration(video.contentDetails.duration); // API取得時にここが必要

    // 形態加点
    if (mins <= 1 && title.includes("#Shorts")) score += (userScores["ショート"] || 0) * 0.3;
    else if (title.includes("アーカイブ") || title.includes("配信")) score += (userScores["配信アーカイブ"] || 0) * 0.3;
    else score += (userScores["動画"] || 0) * 0.3;

    // 時間加点
    if (mins < 60) score += (userScores["1時間未満"] || 0) * 0.2;
    else if (mins < 120) score += (userScores["1時間以上2時間未満"] || 0) * 0.2;
    else score += (userScores["2時間以上"] || 0) * 0.2;

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

        const userScores = (prefs.tagScores as Record<string, number>) || {};
        const selectedToday = prefs.interests || [];

        // スコア上位3つ + ランダム1つを選定
        const sortedTags = Object.keys(TAG_DICTIONARY)
            .sort((a, b) => (userScores[b] || 0) - (userScores[a] || 0))
            .slice(0, 3);
        const remainingTags = Object.keys(TAG_DICTIONARY).filter(t => !sortedTags.includes(t));
        const randomTag = remainingTags[Math.floor(Math.random() * remainingTags.length)];
        const targetTags = [...sortedTags, randomTag];

        const genreResults = await Promise.all(
            targetTags.map(async (tag) => {
                const dict = TAG_DICTIONARY[tag];
                // 検索ワードを強化。「にじさんじ」を必須にすることでヒット率を上げる
                const query = `にじさんじ (${dict.keywords.join(" OR ")})`;

                // 1. まずはYouTube全体から検索 (channelIdを外すとヒット率が100%に近くなります)
                const searchRes = await fetch(
                    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&relevanceLanguage=ja&key=${YOUTUBE_API_KEY}`
                );
                const searchData = await searchRes.json();

                if (!searchData.items || searchData.items.length === 0) {
                    return { genre: tag, items: [] };
                }

                const videoIds = searchData.items.map((v: any) => v.id.videoId).join(",");

                const statsRes = await fetch(
                    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
                );
                const statsData = await statsRes.json();

                const scoredVideos = (statsData.items || [])
                    .map((v: any) => {
                        const score = calculateAdvancedScore(v, tag, userScores, selectedToday.includes(tag));

                        // ★ 推しのチャンネルの動画なら、さらにスコアを爆上げする (+200点)
                        const isOshi = oshiList.some(oshi => oshi.id === v.snippet.channelId);
                        const finalScore = isOshi ? score + 200 : score;

                        return {
                            id: v.id,
                            title: v.snippet.title,
                            thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url,
                            channelTitle: v.snippet.channelTitle,
                            totalScore: finalScore
                        };
                    })
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