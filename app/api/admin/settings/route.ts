import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.appSettings.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ success: true, data: settings });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key, value } = await req.json();
  if (!key || value === undefined) return NextResponse.json({ error: "Key and value required" }, { status: 400 });

  const setting = await prisma.appSettings.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });

  return NextResponse.json({ success: true, data: setting });
}
