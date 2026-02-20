import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

// GET: 保存された設定を取得
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = await prisma.userPreference.findUnique({
    where: { userEmail: session.user.email }
  });

  // データがない場合は、空の構造を返す
  if (!prefs) {
    return NextResponse.json({ 
      interests: [], 
      tagScores: {}, 
      lastSurveyAt: null 
    });
  }

  return NextResponse.json(prefs);
}

// POST: アンケート結果を保存し、スコアを加算する
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { interests } = await req.json(); // 例: ["歌枠", "FPS"]

  // 1. 現在の保存内容（既存のスコアなど）を取得
  const currentPref = await prisma.userPreference.findUnique({
    where: { userEmail: session.user.email }
  });

  // 既存のスコアを取得。なければ空のオブジェクト
  let newScores = (currentPref?.tagScores as Record<string, number>) || {};

  // 2. 今回選ばれたタグに得点を加算 (+10点)
  interests.forEach((tag: string) => {
    newScores[tag] = (newScores[tag] || 0) + 10;
  });

  // 3. データベースを更新 (upsert: なければ作成、あれば更新)
  const prefs = await prisma.userPreference.upsert({
    where: { userEmail: session.user.email },
    update: { 
      interests, 
      tagScores: newScores,
      lastSurveyAt: new Date() // 回答時間を「今」に更新
    },
    create: { 
      userEmail: session.user.email, 
      interests, 
      tagScores: newScores,
      lastSurveyAt: new Date()
    },
  });

  return NextResponse.json(prefs);
}