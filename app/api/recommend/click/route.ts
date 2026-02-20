// app/api/recommend/click/route.ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // clickedTag: クリックされた動画のタグ
  // allDisplayedTags: その時画面に出ていた全ての動画のタグ（重複あり）
  const { clickedTag, allDisplayedTags } = await req.json();

  const currentPref = await prisma.userPreference.findUnique({
    where: { userEmail: session.user.email }
  });

  let newScores = (currentPref?.tagScores as Record<string, number>) || {};

  // 1. 表示されていた全てのタグを一旦 -1点 (減点)
  allDisplayedTags.forEach((tag: string) => {
    newScores[tag] = Math.max(0, (newScores[tag] || 0) - 1);
  });

  // 2. クリックされたタグだけ +21点 (差し引き +20点 加点)
  newScores[clickedTag] = (newScores[clickedTag] || 0) + 21;

  await prisma.userPreference.update({
    where: { userEmail: session.user.email },
    data: { tagScores: newScores }
  });

  return NextResponse.json({ success: true });
}