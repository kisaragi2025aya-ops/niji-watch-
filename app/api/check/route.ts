import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelIdsString = searchParams.get("channelIds");
  if (!channelIdsString) return NextResponse.json({});

  const channelIds = channelIdsString.split(",");
  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    const allLiveStatus: any = {};

    // 1. 各チャンネルの配信ページ(HTML)をチェックして「動画ID」を特定 (0クォータ)
    const liveVideoIds = await Promise.all(channelIds.map(async (id) => {
      try {
        const res = await fetch(`https://www.youtube.com/channel/${id}/live`, { 
          cache: 'no-store',
          headers: { 'User-Agent': 'Mozilla/5.0' } // ブロック防止
        });
        const html = await res.text();
        const match = html.match(/"videoId":"(.*?)"/);
        
        // HTML内のライブフラグをチェック（判定を強化しました）
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

    // 2. 特定した動画IDを50個ずつ「videos.list」に投げる (1ユニット/50人)
    const activeLives = liveVideoIds.filter(v => v.videoId !== null);
    
    if (activeLives.length > 0) {
      const chunks = [];
      for (let i = 0; i < activeLives.length; i += 50) {
        chunks.push(activeLives.slice(i, i + 50));
      }

      await Promise.all(chunks.map(async (chunk) => {
        const ids = chunk.map(v => v.videoId).join(",");
        // liveStreamingDetailsを追加して、現在の視聴者数や正確なライブ判定を可能にする
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${ids}&key=${apiKey}`);
        const data = await res.json();

        data.items?.forEach((item: any) => {
          const ownerChannelId = activeLives.find(v => v.videoId === item.id)?.channelId;
          if (ownerChannelId) {
            // actualStartTimeがあれば配信中。actualEndTimeがあれば終了済み。
            const isActuallyLive = !!item.liveStreamingDetails?.actualStartTime && !item.liveStreamingDetails?.actualEndTime;
            
            allLiveStatus[ownerChannelId] = {
              isLive: isActuallyLive,
              title: item.snippet.title,
              thumbnail: item.snippet.thumbnails?.medium?.url,
            };
          }
        });
      }));
    }

    // 3. ライブしていない人をオフラインとして補完
    channelIds.forEach(id => {
      if (!allLiveStatus[id]) allLiveStatus[id] = { isLive: false };
    });

    return NextResponse.json(allLiveStatus);
  } catch (error) {
    console.error("API Check Error:", error);
    return NextResponse.json({});
  }
}