import { PrismaClient } from "@prisma/client";
import { judgeCategory } from "../lib/constants"; // パスは適宜調整
const prisma = new PrismaClient();

async function main() {
  console.log("🔄 動画のタグ（カテゴリ）再計算を開始します...");

  // 全動画を取得
  const videos = await prisma.cachedVideo.findMany({
    select: { id: true, title: true }
  });

  console.log(`${videos.length} 件の動画を処理中...`);

  // 高速に一括更新
  for (const v of videos) {
    const newCategories = judgeCategory(v.title);
    
    await prisma.cachedVideo.update({
      where: { id: v.id },
      data: { categories: newCategories }
    });
  }

  console.log("✅ 全動画のタグ更新が完了しました！");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());