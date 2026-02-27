// scripts/clear-videos.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 動画データの削除を開始します...");

  // CachedVideo テーブルの全レコードを削除
  const deleteResult = await prisma.cachedVideo.deleteMany({});

  console.log(`✅ 削除完了: ${deleteResult.count} 件の動画を削除しました。`);
}

main()
  .catch((e) => {
    console.error("❌ エラーが発生しました:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });