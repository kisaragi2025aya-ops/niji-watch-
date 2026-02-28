import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelIdsString = searchParams.get("channelIds");
  if (!channelIdsString) return NextResponse.json({});

  const channelIds = channelIdsString.split(",");
  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    const allLiveStatus: any = {};

    // 1. 各チャンネルの配信ページから動画IDを特定
    const liveVideoIds = await Promise.all(channelIds.map(async (id) => {
      try {
        const res = await fetch(`https://www.youtube.com/channel/${id}/live`, { 
          cache: 'no-store',
          headers: { 'User-Agent': 'Mozilla/5.0' }
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

    // 2. 動画IDからチャンネルIDを即座に引ける「辞書」を作る（重要：取り違え防止）
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
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${ids}&key=${apiKey}`);
        const data = await res.json();

        data.items?.forEach((item: any) => {
          // ✅ 辞書を使って、この動画の持ち主を正確に特定
          const ownerChannelId = videoToChannelMap[item.id];
          
          if (ownerChannelId) {
            // API側での正確なライブ判定（liveBroadcastContent が "live" であることを優先）
            const isActuallyLive = 
              item.snippet.liveBroadcastContent === "live" ||
              (!!item.liveStreamingDetails?.actualStartTime && !item.liveStreamingDetails?.actualEndTime);
            
            if (isActuallyLive) {
              allLiveStatus[ownerChannelId] = {
                isLive: true,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
              };
            }
          }
        });
      }));
    }

    // 3. ライブしていない人をオフラインとして補完
    channelIds.forEach(id => {
      if (!allLiveStatus[id]) {
        allLiveStatus[id] = { isLive: false };
      }
    });

    return NextResponse.json(allLiveStatus);
  } catch (error) {
    console.error("API Check Error:", error);
    return NextResponse.json({});
  }
}