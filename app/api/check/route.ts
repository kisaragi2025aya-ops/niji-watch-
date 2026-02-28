import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelIdsString = searchParams.get("channelIds");
  if (!channelIdsString) return NextResponse.json({});

  const channelIds = channelIdsString.split(",");
  const apiKey = process.env.YOUTUBE_API_KEY;
  const cacheBuster = Math.random().toString(36).substring(7);

  try {
    const allLiveStatus: any = {};

    // 1. 各チャンネルの配信ページから動画IDの「候補」だけを抜く
    const videoIdCandidates = await Promise.all(channelIds.map(async (id) => {
      try {
        const res = await fetch(`https://www.youtube.com/channel/${id}/live?t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        const html = await res.text();

        // 所有者確認（IDが含まれているかだけ最低限チェック）
        if (!html.includes(id)) return { channelId: id, videoId: null };

        // 動画IDを抽出
        const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=(.*?)">/);
        const videoId = canonicalMatch ? canonicalMatch[1] : (html.match(/"videoId":"(.*?)"/)?.[1] || null);

        return { channelId: id, videoId };
      } catch {
        return { channelId: id, videoId: null };
      }
    }));

    // 2. 拾ったIDをすべてYouTube APIに投げ、公式の「ライブ状態」を確認
    const candidates = videoIdCandidates.filter(v => v.videoId !== null);
    const videoToChannelMap: Record<string, string> = {};
    candidates.forEach(v => { if (v.videoId) videoToChannelMap[v.videoId] = v.channelId; });
    
    if (candidates.length > 0) {
      const chunks = [];
      for (let i = 0; i < candidates.length; i += 50) chunks.push(candidates.slice(i, i + 50));

      await Promise.all(chunks.map(async (chunk) => {
        const ids = chunk.map(v => v.videoId).join(",");
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${ids}&key=${apiKey}&cb=${cacheBuster}`, 
          { cache: 'no-store' }
        );
        const data = await res.json();

        data.items?.forEach((item: any) => {
          const ownerChannelId = videoToChannelMap[item.id];
          if (ownerChannelId && item.snippet.channelId === ownerChannelId) {
            
            // ✅ 絶対的なライブ判定（YouTube公式データ）
            // "live" は現在配信中。"upcoming"（予約）や "none"（アーカイブ）は無視されます。
            const isLive = item.snippet.liveBroadcastContent === "live";
            
            if (isLive) {
              allLiveStatus[ownerChannelId] = {
                isLive: true,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.high?.url,
              };
            }
          }
        });
      }));
    }

    // 3. 補完
    channelIds.forEach(id => {
      if (!allLiveStatus[id]) allLiveStatus[id] = { isLive: false };
    });

    return NextResponse.json(allLiveStatus);
  } catch (error) {
    console.error("API Check Error:", error);
    return NextResponse.json({});
  }
}