import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } }, document: { select: { docNumber: true } } },
  });

  return NextResponse.json({ success: true, data: transactions });
}
