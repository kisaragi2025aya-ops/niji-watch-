import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) return NextResponse.json({ isLive: false });

  try {
    const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      next: { revalidate: 0 }
    });

    const html = await response.text();

    // 1. ライブ判定の強化
    const hasLiveKeyword = html.includes('"style":"LIVE"') || html.includes('{"text":" ライブ配信中"}') || html.includes('"isLive":true');
    const isUpcoming = html.includes('"isUpcoming":true') || html.includes('upcomingEventData');
    const isLive = hasLiveKeyword && !isUpcoming;

    let thumbnail = null;
    let title = null;

    if (isLive) {
      // 2. タイトルの抽出（複数のパターンで試行）
      const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"/);
      const titleMatchAlt = html.match(/<title>([^<]+) - YouTube<\/title>/);
      
      if (titleMatch) {
        title = titleMatch[1].replace(/\\u0026/g, '&');
      } else if (titleMatchAlt) {
        title = titleMatchAlt[1];
      } else {
        title = "ライブ配信中";
      }

      // 3. 動画ID（サムネイル用）の抽出（複数のパターンで試行）
      // パターンA: liveStreamRenderer
      let videoIdMatch = html.match(/"liveStreamRenderer":\{"videoId":"([^"]+)"/);
      // パターンB: videoId を直接探す
      if (!videoIdMatch) videoIdMatch = html.match(/"videoId":"([^"]+)"/);

      const videoId = videoIdMatch ? videoIdMatch[1] : null;

      if (videoId) {
        // maxresdefault がない場合もあるので、標準的な hqdefault も予備として考えられますが、まずはこれで
        thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    return NextResponse.json({ 
      isLive, 
      thumbnail,
      title
    });
  } catch (error) {
    console.error("Check Error:", error);
    return NextResponse.json({ isLive: false, thumbnail: null, title: null });
  }
}