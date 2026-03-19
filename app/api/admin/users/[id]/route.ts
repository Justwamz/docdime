import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return null;
  return session;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      documents: { orderBy: { createdAt: "desc" }, take: 10 },
      transactions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { plan, isAdmin } = await req.json();

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(plan && { plan }),
      ...(isAdmin !== undefined && { isAdmin }),
    },
  });

  return NextResponse.json({ success: true, data: user });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
