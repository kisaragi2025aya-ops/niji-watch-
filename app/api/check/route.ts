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

    // 1. 各チャンネルの配信ページから動画IDを特定（HTMLスクレイピング）
    const liveVideoIds = await Promise.all(channelIds.map(async (id) => {
      try {
        const res = await fetch(`https://www.youtube.com/channel/${id}/live?t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        const html = await res.text();

        // 判定①：このページが「自分のチャンネル」であることを確認（緩めの判定）
        const isOwner = html.includes(id) || html.includes(`"browseId":"${id}"`);
        if (!isOwner) return { channelId: id, videoId: null };

        // 判定②：動画IDを抽出（canonical優先、なければvideoId）
        let videoId = null;
        const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=(.*?)">/);
        if (canonicalMatch) {
          videoId = canonicalMatch[1];
        } else {
          const generalMatch = html.match(/"videoId":"(.*?)"/);
          videoId = generalMatch ? generalMatch[1] : null;
        }

        // HTML上で「ライブ」または「待機中」のキーワードがあれば、APIでの検証に回す
        const isPotentialLive = html.includes('LIVE') || html.includes('ライブ') || html.includes('isLive');

        if (videoId && isPotentialLive) {
          return { channelId: id, videoId: videoId };
        }
        return { channelId: id, videoId: null };
      } catch {
        return { channelId: id, videoId: null };
      }
    }));

    // 2. 抽出した動画IDをYouTube APIで厳格に検証
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
            // ✅ ここが最終防衛線：YouTube APIが公式に認める「配信中」の状態のみをパスさせる
            // 且つ、動画のチャンネルIDが推しのものと一致するか再確認
            const itemChannelId = item.snippet.channelId;
            const isActuallyLive = item.snippet.liveBroadcastContent === "live";
            
            if (isActuallyLive && itemChannelId === ownerChannelId) {
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