import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // authOptionsをexportしている場合

const prisma = new PrismaClient();

// 判定用のリスト（まずは数名でテストし、後でスプレッドシート等から一括取得する形に進化させましょう）
const NIJISANJI_CHANNELS = [
  { id: "UC1u2zOt5magiG7dfp8qf08g", name: "アンジュ・カトリーナ" },
  { id: "UCD-miitqNY3nyukJ4Fnf4_A", name: "月ノ美兎" },
  { id: "UCspv01oxUFf_MTSipURRhkA", name: "叶" },
  { id: "UCp6993tm3UPKxGdKquLp7vA", name: "笹木咲" },
  { id: "UC0Ww9sfDcacbbAo9_dzzj4A", name: "夕陽リリ" },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  // @ts-ignore
  const accessToken = session?.accessToken;

  if (!accessToken || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. YouTube APIを叩いて登録チャンネル（Subscriptions）を取得
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const data = await response.json();

    if (!data.items) {
      return NextResponse.json({ message: "No subscriptions found" });
    }

    // 2. 登録チャンネルの中から「にじさんじ」に該当する人をフィルタリング
    const myOshiInNijisanji = data.items
      .map((item: any) => ({
        id: item.snippet.resourceId.channelId,
        name: item.snippet.title,
      }))
      .filter((channel: any) =>
        NIJISANJI_CHANNELS.some(niji => niji.id === channel.id)
      );

    // 3. Prismaのupsertで、新しい人だけDBに保存（重複は上書き）
    const results = await Promise.all(
      myOshiInNijisanji.map((oshi: any) =>
        prisma.oshi.upsert({
          where: { id: oshi.id }, // IDが一致するデータがあれば
          update: { name: oshi.name }, // 名前を最新に更新
          create: { // なければ新規作成
            id: oshi.id,
            name: oshi.name,
            userEmail: session.user?.email || "",
          },
        })
      )
    );

    return NextResponse.json({
      message: "Sync complete!",
      count: results.length,
      syncedNames: results.map(r => r.name)
    });
  } catch (error: any) {
    console.error("Sync Error:", error);
    return NextResponse.json({
      error: "Failed to sync",
      details: error.message, // エラーメッセージを表示
      stack: error.stack      // どこでエラーが起きたかを表示
    }, { status: 500 });
  }
}