import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const templates = await prisma.emailTemplate.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ success: true, data: templates });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, subject, body, variables } = await req.json();

  const template = await prisma.emailTemplate.create({
    data: { name, subject, body, variables: variables ?? [] },
  });

  return NextResponse.json({ success: true, data: template }, { status: 201 });
}
