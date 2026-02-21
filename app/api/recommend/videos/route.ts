import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CACHE_LIMIT_HOURS = 2; // キャッシュ保持時間

const TAG_DICTIONARY: { [key: string]: { keywords: string[] } } = {
    "雑談": { keywords: ["雑談", "凸待ち", "飲み枠", "作業用"] },
    "歌枠": { keywords: ["歌枠", "歌ってみた", "SINGING", "KARAOKE"] },
    "FPS": { keywords: ["VALORANT", "Apex", "オーバーウォッチ", "ストグラ", "LOL"] },
    "原神": { keywords: ["原神", "Genshin", "テイワット", "螺旋"] },
    "3Dライブ": { keywords: ["3Dライブ", "3D配信", "記念配信"] },
    "ASMR": { keywords: ["ASMR", "バイノーラル", "囁き"] },
    "麻雀": { keywords: ["雀魂", "麻雀", "段位戦"] },
    "ホラー": { keywords: ["ホラーゲーム", "地獄銭湯", "影廊"] },
};

// ヘルパー: 時間変換
function parseDuration(duration?: string): number {
    if (!duration) return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] || "0") * 60) + parseInt(match[2] || "0");
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const [prefs, oshiList] = await Promise.all([
            prisma.userPreference.findUnique({ where: { userEmail: session.user.email } }),
            prisma.oshi.findMany({ where: { userEmail: session.user.email } })
        ]);

        if (!prefs || oshiList.length === 0) return NextResponse.json({ genres: [] });
        const userScores = (prefs.tagScores as Record<string, number>) || {};

        // --- キャッシュチェック ---
        const lastCache = await prisma.cachedVideo.findFirst({
            orderBy: { cachedAt: 'desc' }
        });

        let videoPool;
        const now = new Date();
        const cacheIsFresh = lastCache && (now.getTime() - lastCache.cachedAt.getTime() < CACHE_LIMIT_HOURS * 60 * 60 * 1000);

        if (cacheIsFresh) {
            // キャッシュが新鮮ならDBから取得
            console.log("Using cached videos...");
            videoPool = await prisma.cachedVideo.findMany();
        } else {
            // キャッシュが古い、または無い場合はYouTube APIを叩く (120分に1回だけ)
            console.log("Fetching new videos from YouTube API...");
            await prisma.cachedVideo.deleteMany(); // 古いキャッシュをクリア

            const allFetchedVideos: any[] = [];
            
            // プレイリスト方式で取得 (激安)
            for (const oshi of oshiList) {
                const uploadsId = oshi.id.replace(/^UC/, "UU");
                const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=15&key=${YOUTUBE_API_KEY}`);
                const data = await res.json();
                if (data.items) allFetchedVideos.push(...data.items);
            }

            const videoIds = allFetchedVideos.map((v: any) => v.snippet.resourceId.videoId).join(",");
            const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
            const statsData = await statsRes.json();
            
            const fullVideos = statsData.items || [];

            // 取得した動画をDBにキャッシュ保存
            const cacheData = fullVideos.map((v: any) => ({
                id: v.id,
                title: v.snippet.title,
                thumbnail: v.snippet.thumbnails.high?.url || "",
                channelTitle: v.snippet.channelTitle,
                channelId: v.snippet.channelId,
                category: "general", // 分類は後で行う
                publishedAt: new Date(v.snippet.publishedAt),
                duration: v.contentDetails.duration,
                viewCount: v.statistics.viewCount || "0",
            }));

            await prisma.cachedVideo.createMany({ data: cacheData });
            videoPool = await prisma.cachedVideo.findMany();
        }

        // --- スコア計算と振り分け (ここはリロードのたびに計算して最新の好みを反映) ---
        const targetTags = Object.keys(TAG_DICTIONARY)
            .sort((a, b) => (userScores[b] || 0) - (userScores[a] || 0))
            .slice(0, 3);
        const remaining = Object.keys(TAG_DICTIONARY).filter(t => !targetTags.includes(t));
        targetTags.push(remaining[Math.floor(Math.random() * remaining.length)]);

        const genreResults = targetTags.map(tag => {
            const keywords = TAG_DICTIONARY[tag].keywords;
            const filtered = videoPool
                .filter((v: any) => keywords.some(kw => v.title.includes(kw)))
                .map((v: any) => {
                    // ここで以前の calculateAdvancedScore 相当の計算を行う
                    let score = Math.log10(parseInt(v.viewCount) + 1) * 5;
                    const diffDays = (now.getTime() - v.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
                    score += Math.max(0, 30 - diffDays) * 1.5;
                    score += (userScores[tag] || 0) * 0.5;

                    const mins = parseDuration(v.duration);
                    if (mins <= 1 && v.title.includes("#Shorts")) score += (userScores["ショート"] || 0) * 0.3;
                    else if (v.title.includes("アーカイブ") || v.title.includes("配信")) score += (userScores["配信アーカイブ"] || 0) * 0.3;
                    else score += (userScores["動画"] || 0) * 0.3;

                    return {
                        id: v.id,
                        title: v.title,
                        thumbnail: v.thumbnail,
                        channelTitle: v.channelTitle,
                        totalScore: oshiList.some(o => o.id === v.channelId) ? score + 200 : score
                    };
                })
                .sort((a: any, b: any) => b.totalScore - a.totalScore)
                .slice(0, 4);

            return { genre: tag, items: filtered };
        });

        return NextResponse.json({ genres: genreResults });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}