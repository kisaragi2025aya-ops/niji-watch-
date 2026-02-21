import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

function parseDuration(duration?: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || "0") * 60 + parseInt(match[2] || "0");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clickedTag, allDisplayedTags, videoTitle, videoId } = await req.json();

  const currentPref = await prisma.userPreference.findUnique({ where: { userEmail: session.user.email } });
  let newScores = (currentPref?.tagScores as Record<string, number>) || {};

  // 減点
  allDisplayedTags.forEach((tag: string) => {
    newScores[tag] = Math.max(0, (newScores[tag] || 0) - 1);
  });

  // 加点
  newScores[clickedTag] = (newScores[clickedTag] || 0) + 21; // 減点分相殺

  try {
    const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
    const videoData = await videoRes.json();
    const item = videoData.items?.[0];

    if (item) {
      const mins = parseDuration(item.contentDetails.duration);
      // 形態
      if (mins <= 1 && videoTitle.includes("#Shorts")) newScores["ショート"] = (newScores["ショート"] || 0) + 15;
      else if (videoTitle.includes("アーカイブ") || videoTitle.includes("配信")) newScores["配信アーカイブ"] = (newScores["配信アーカイブ"] || 0) + 15;
      else newScores["動画"] = (newScores["動画"] || 0) + 15;

      // 時間
      if (mins < 60) newScores["1時間未満"] = (newScores["1時間未満"] || 0) + 10;
      else if (mins < 120) newScores["1時間以上2時間未満"] = (newScores["1時間以上2時間未満"] || 0) + 10;
      else newScores["2時間以上"] = (newScores["2時間以上"] || 0) + 10;

      // シリーズ (FPSタグがあればシリーズ判定しない等のロジックはここ)
      if (!videoTitle.match(/Apex|VALORANT|LOL/i) && /[#＃]\d+|(?:Part|Day|第)\s*\d+/i.test(videoTitle)) {
        newScores["シリーズ"] = (newScores["シリーズ"] || 0) + 15;
      } else {
        newScores["単発"] = (newScores["単発"] || 0) + 10;
      }
    }
  } catch (e) { console.error(e); }

  await prisma.userPreference.update({
    where: { userEmail: session.user.email },
    data: { tagScores: newScores }
  });

  return NextResponse.json({ success: true });
}