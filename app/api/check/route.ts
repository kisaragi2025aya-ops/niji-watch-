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

  try {
    const allLiveStatus: any = {};

    // 1. 各チャンネルの「最新のアクティビティ」を取得 (クォータ1回につき1ユニット)
    // search(100ユニット)より圧倒的に安く、VercelのIP制限も受けません
    await Promise.all(channelIds.map(async (id) => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&channelId=${id}&maxResults=3&key=${apiKey}`,
          { cache: 'no-store' }
        );
        const data = await res.json();

        // アクティビティの中から「ライブ配信」または「動画投稿」を探す
        const liveActivity = data.items?.find((item: any) => 
          item.snippet.type === "upload" || item.contentDetails?.upload
        );

        if (liveActivity) {
          const videoId = liveActivity.contentDetails.upload.videoId;
          
          // 2. 見つけた最新動画が「今まさにライブ中か」を判定 (クォータ1ユニット)
          const videoRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${apiKey}`,
            { cache: 'no-store' }
          );
          const videoData = await videoRes.json();
          const videoItem = videoData.items?.[0];

          if (videoItem && videoItem.snippet.liveBroadcastContent === "live") {
            allLiveStatus[id] = {
              isLive: true,
              title: videoItem.snippet.title,
              thumbnail: videoItem.snippet.thumbnails?.medium?.url,
            };
          }
        }
      } catch (e) {
        console.error(`Error checking channel ${id}:`, e);
      }
    }));

    // 3. ライブしていない人をオフラインとして埋める
    channelIds.forEach(id => {
      if (!allLiveStatus[id]) allLiveStatus[id] = { isLive: false };
    });

    return NextResponse.json(allLiveStatus);
  } catch (error) {
    console.error("Critical API Error:", error);
    return NextResponse.json({});
  }
}