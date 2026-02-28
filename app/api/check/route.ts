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

    const liveVideoIds = await Promise.all(channelIds.map(async (id) => {
      try {
        const res = await fetch(`https://www.youtube.com/channel/${id}/live?t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
          }
        });
        const html = await res.text();

        // 【改善】HTMLの中から「このページ自体の動画ID」をより正確に抜き出す
        // <link rel="canonical" href="https://www.youtube.com/watch?v=VIDEO_ID"> から抽出
        const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=(.*?)">/);
        
        // 【改善】その動画の投稿者が自分自身(id)であるかを厳格にチェック
        const isOwner = html.includes(`"externalChannelId":"${id}"`) || 
                        html.includes(`"channelId":"${id}"`) ||
                        html.includes(`/channel/${id}`);

        // ライブ中かどうかのフラグ
        const isLiveOrWaiting = 
          html.includes('{"style":"LIVE","label":"LIVE"}') || 
          html.includes('{"style":"LIVE","label":"ライブ"}') ||
          html.includes('"isLive":true');

        if (canonicalMatch && isOwner && isLiveOrWaiting) {
          return { channelId: id, videoId: canonicalMatch[1] };
        }
        return { channelId: id, videoId: null };
      } catch {
        return { channelId: id, videoId: null };
      }
    }));

    // 以降、APIでの詳細確認（以前のMapロジックを継承）
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

    channelIds.forEach(id => {
      if (!allLiveStatus[id]) allLiveStatus[id] = { isLive: false };
    });

    return NextResponse.json(allLiveStatus);
  } catch (error) {
    console.error("API Check Error:", error);
    return NextResponse.json({});
  }
}