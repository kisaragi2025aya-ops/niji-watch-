import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) return NextResponse.json({ isLive: false });

  try {
    const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      next: { revalidate: 0 }
    });

    const html = await response.text();

    // --- ここが重要：判定ロジックの強化 ---
    
    // 1. 「ライブ配信中」というキーワードがあるか
    const hasLiveKeyword = html.includes('"style":"LIVE"') || html.includes('{"text":" ライブ配信中"}');
    
    // 2. 「配信予定（待機所）」ではないことを確認する
    // 予定の場合は "isUpcoming":true や "upcomingEventData" という文字が含まれます
    const isUpcoming = html.includes('"isUpcoming":true') || html.includes('upcomingEventData');

    // 🔴「ライブの印」があり、かつ「予定」ではない場合のみ、本当のライブとみなす
    const isLive = hasLiveKeyword && !isUpcoming;

    return NextResponse.json({ isLive });
  } catch (error) {
    return NextResponse.json({ isLive: false });
  }
}