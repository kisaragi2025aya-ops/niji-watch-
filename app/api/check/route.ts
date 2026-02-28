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

    // 1. 各チャンネルの配信ページから動画IDを特定
    const videoIdCandidates = await Promise.all(channelIds.map(async (id) => {
      try {
        // redirect: 'follow' を明示し、一般公開ライブのリダイレクトを追いかける
        const res = await fetch(`https://www.youtube.com/channel/${id}/live?t=${cacheBuster}`, { 
          cache: 'no-store',
          redirect: 'follow', 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
          }
        });
        const html = await res.text();

        // 動画ID抽出（複数のパターンで探す）
        let videoId = null;
        
        // パターンA: canonical (リダイレクト先がwatchページならこれが確実)
        const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=(.*?)">/);
        // パターンB: 短縮URL
        const shortMatch = html.match(/href="https:\/\/youtu\.be\/(.*?)"/);
        // パターンC: JSONデータ内
        const jsonMatch = html.match(/"videoId":"(.*?)"/);

        if (canonicalMatch) videoId = canonicalMatch[1];
        else if (shortMatch) videoId = shortMatch[1];
        else if (jsonMatch) videoId = jsonMatch[1];

        return { channelId: id, videoId };
      } catch {
        return { channelId: id, videoId: null };
      }
    }));

    // 2. YouTube APIで「本当にライブ中か」を最終確認
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
          // 投稿者が一致し、かつステータスが "live" であること（予約枠 upcoming はここで弾かれる）
          if (ownerChannelId && item.snippet.channelId === ownerChannelId) {
            if (item.snippet.liveBroadcastContent === "live") {
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