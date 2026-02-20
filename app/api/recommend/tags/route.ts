// app/api/recommend/tags/route.ts
import { NextResponse } from "next/server";

// あなたが今後追加していくタグのリスト（辞書のキー）
const ALL_TAG_LIST = [
  "雑談", "歌枠", "FPS", "ゲーム実況", "原神", 
  "3Dライブ", "ASMR", "麻雀", "凸待ち", "新衣装",
  "ホラー", "マシュマロ", "作業用", "振り返り"
];

export async function GET() {
  // 配列をシャッフルして先頭10個を取り出す
  const shuffled = [...ALL_TAG_LIST].sort(() => 0.5 - Math.random());
  const selectedTags = shuffled.slice(0, 10);

  return NextResponse.json({ tags: selectedTags });
}