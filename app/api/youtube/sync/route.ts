import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

const NIJISANJI_CHANNELS = [
  { id: "UCD-miitqNY3nyukJ4Fnf4_A", name: "月ノ美兎" },
  { id: "UCYKP16oMX9KKPbrNgo_Kgag", name: "える" },
  { id: "UCsg-YqdqQ-KFF0LNk23BY4A", name: "樋口楓" },
  { id: "UC6oDys1BGgBsIC3WhG1BovQ", name: "静凛" },
  { id: "UCeK9HFcRZoTrvqcUCtccMoQ", name: "渋谷ハジメ" },
  { id: "UCvmppcdYf4HOv-tFQhHHJMA", name: "モイラ" },
  { id: "UCmUjjW5zF1MMOhYUwwwQv9Q", name: "宇志海いちご" },
  { id: "UC_GCs6GARLxEHxy1w40d6VQ", name: "家長むぎ" },
  { id: "UC48jH1ul-6HOrcSSfoR02fQ", name: "夕陽リリ" },
  { id: "UCt0clH12Xk1-Ej5PXKGfdPA", name: "物述有栖" },
  { id: "UCBiqkFJljoxAj10SoP2w2Cg", name: "文野環" },
  { id: "UCXU7YYxy_iQd3ulXyO-zC2w", name: "伏見ガク" },
  { id: "UCUzJ90o1EjqUbk2pBAy0_aw", name: "ギルザレンⅢ世" },
  { id: "UCv1fFr156jc65EMiLbaLImw", name: "剣持刀也" },
  { id: "UCtpB6Bvhs1Um93ziEDACQ8g", name: "森中花咲" },
  { id: "UCspv01oxUFf_MTSipURRhkA", name: "叶" },
  { id: "UCBi8YaVyZpiKWN3_Z0dCTfQ", name: "赤羽葉子" },
  { id: "UCoztvTULBYd3WmStqYeoHcA", name: "笹木咲" },
  { id: "UC0g1AE0DOjBYnLhkgoRWN1w", name: "本間ひまわり" },
  { id: "UC9EjSJ8pvxtvPdxLOElv73w", name: "魔界ノりりむ" },
  { id: "UCSFCh5NL4qXrAy9u-u2lX3g", name: "葛葉 " },
  { id: "UC_4tXjqecqox5Uc05ncxpxg", name: "椎名唯華" },
  { id: "UC53UDnhAAYwvNO7j_2Ju1cQ", name: "ドーラ" },
  { id: "UCRV9d6YCYIMUszK-83TwxVA", name: "轟京子" },
  { id: "UC1zFJrfEKvCixhsjNSb1toQ", name: "シスター・クレア" },
  { id: "UCsFn_ueskBkMCEyzCEqAOvg", name: "花畑チャイカ" },
  { id: "UCKMYISTJAQ8xTplUPHiABlA", name: "社築" },
  { id: "UCryOPk2GZ1meIDt53tL30Tw", name: "鈴木勝" },
  { id: "UCt5-0i4AVHXaWJrL8Wql3mw", name: "緑仙" },
  { id: "UC3lNFeJiTq6L3UWoz4g1e-A", name: "卯月コウ" },
  { id: "UCWz0CSYCxf4MhRKPDm220AQ", name: "神田笑一" },
  { id: "UCiSRx1a2k-0tOg-fs6gAolQ", name: "飛鳥ひな" },
  { id: "UCtAvQ5U0aXyKwm2i4GqFgJg", name: "春崎エアル" },
  { id: "UCRWOdwLRsenx2jLaiCAIU4A", name: "雨森小夜" },
  { id: "UCV5ZZlLjk5MKGg3L0n0vbzw", name: "鷹宮リオン" },
  { id: "UCJubINhCcFXlsBwnHp0wl_g", name: "舞元啓介" },
  { id: "UCPvGypSgfDkVe7JG2KygK7A", name: "竜胆尊" },
  { id: "UCjlmCrq4TP1I4xguOtJ-31w", name: "でびでび・でびる" },
  { id: "UCfQVs_KuXeNAlGa3fb8rlnQ", name: "桜凛月" },
  { id: "UCo7TRj3cS-f_1D9ZDmuTsjw", name: "町田ちま" },
  { id: "UChUJbHiTVeGrSkTdBzVfNCQ", name: "ジョー・力一" },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  // @ts-ignore
  const accessToken = session?.accessToken;

  if (!accessToken || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    // 1. YouTube APIから ID, 名前, アイコンURL を抽出
    const myOshiInNijisanji = data.items
      .map((item: any) => ({
        id: item.snippet.resourceId.channelId,
        name: item.snippet.title,
        image: item.snippet.thumbnails?.default?.url, // アイコンURLを取得
      }))
      .filter((channel: any) =>
        NIJISANJI_CHANNELS.some(niji => niji.id === channel.id)
      );

    // 2. Prismaで image フィールドも含めて保存
    const results = await Promise.all(
      myOshiInNijisanji.map((oshi: any) =>
        prisma.oshi.upsert({
          // 前回の修正に合わせて複合ユニークキー(id_userEmail)がある場合はそちらを使うのが安全です
          where: { 
            id_userEmail: { id: oshi.id, userEmail: session.user?.email || "" } 
          },
          update: { 
            name: oshi.name,
            image: oshi.image // アイコンURLを最新に更新
          },
          create: { 
            id: oshi.id,
            name: oshi.name,
            userEmail: session.user?.email || "",
            image: oshi.image // 新規作成時もアイコンURLを保存
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
      details: error.message,
    }, { status: 500 });
  }
}