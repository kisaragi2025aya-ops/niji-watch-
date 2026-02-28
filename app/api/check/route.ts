import { NextResponse } from "next/server";

// Vercel/Next.js のキャッシュを完全に無効化する魔法の3行
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelIdsString = searchParams.get("channelIds");
  if (!channelIdsString) return NextResponse.json({});

  const channelIds = channelIdsString.split(",");
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  // リクエストごとにランダムな値を生成（キャッシュ破棄用）
  const cacheBuster = Math.random().toString(36).substring(7);

  try {
    const allLiveStatus: any = {};

    // 1. 各チャンネルの配信ページから動画IDを特定
    const liveVideoIds = await Promise.all(channelIds.map(async (id) => {
      try {
        // URLにランダムな値を足して、Vercelがキャッシュを使うのを防ぐ
        const res = await fetch(`https://www.youtube.com/channel/${id}/live?t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: { 
            'User-Agent': 'Mozilla/5.0',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        const html = await res.text();
        const match = html.match(/"videoId":"(.*?)"/);
        
        const isLiveOrWaiting = 
          html.includes('{"style":"LIVE","label":"LIVE"}') || 
          html.includes('{"style":"LIVE","label":"ライブ"}') ||
          html.includes('"isLive":true') ||
          (html.includes('"status":"ok"') && html.includes('"isLiveContent":true'));
        
        if (isLiveOrWaiting && match) return { channelId: id, videoId: match[1] };
        return { channelId: id, videoId: null };
      } catch {
        return { channelId: id, videoId: null };
      }
    }));

    // 2. 動画IDとチャンネルIDを強固に紐付け
    const activeLives = liveVideoIds.filter(v => v.videoId !== null);
    const videoToChannelMap: Record<string, string> = {};
    activeLives.forEach(v => {
      if (v.videoId) videoToChannelMap[v.videoId] = v.channelId;
    });
    
    if (activeLives.length > 0) {
      const chunks = [];
      for (let i = 0; i < activeLives.length; i += 50) {
        chunks.push(activeLives.slice(i, i + 50));
      }

      await Promise.all(chunks.map(async (chunk) => {
        const ids = chunk.map(v => v.videoId).join(",");
        // YouTube APIへのリクエストにもキャッシュ対策を施す
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${ids}&key=${apiKey}&cb=${cacheBuster}`, 
          { cache: 'no-store' }
        );
        const data = await res.json();

        data.items?.forEach((item: any) => {
          const ownerChannelId = videoToChannelMap[item.id];
          
          if (ownerChannelId) {
            const isActuallyLive = 
              item.snippet.liveBroadcastContent === "live" ||
              (!!item.liveStreamingDetails?.actualStartTime && !item.liveStreamingDetails?.actualEndTime);
            
            if (isActuallyLive) {
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