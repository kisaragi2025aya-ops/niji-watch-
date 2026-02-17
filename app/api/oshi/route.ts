// app/api/oshi/route.ts

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

const prisma = new PrismaClient();

// 取得 (GET)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json([], { status: 401 });
  
  // selectを指定しなくても、Prismaは通常全フィールド返しますが、
  // 明示的に image も含まれる findMany を実行します
  const oshiList = await prisma.oshi.findMany({ 
    where: { userEmail: session.user.email },
    orderBy: { createdAt: 'desc' } // ついでに登録順に並べると見やすいです
  });
  return NextResponse.json(oshiList);
}

// 追加 (POST)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  // リクエストから image も受け取れるように変更
  const { id, name, image } = await req.json();
  
  const result = await prisma.oshi.upsert({
    where: { id_userEmail: { id, userEmail: session.user.email } },
    update: { 
      name,
      image: image || undefined // imageがあれば更新
    },
    create: { 
      id, 
      name, 
      userEmail: session.user.email,
      image: image || null // 新規作成時
    },
  });
  return NextResponse.json(result);
}

// 削除 (DELETE)
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!session?.user?.email || !id) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  await prisma.oshi.delete({
    where: { id_userEmail: { id, userEmail: session.user.email } }
  });
  return NextResponse.json({ success: true });
}