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
  const oshiList = await prisma.oshi.findMany({ where: { userEmail: session.user.email } });
  return NextResponse.json(oshiList);
}

// 追加 (POST)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, name } = await req.json();
  const result = await prisma.oshi.upsert({
    where: { id_userEmail: { id, userEmail: session.user.email } }, // 複合ユニーク制約に対応
    update: { name },
    create: { id, name, userEmail: session.user.email },
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